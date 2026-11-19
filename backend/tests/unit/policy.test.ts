import { describe, it, expect } from 'vitest';
import {
  canViewRequest,
  canCancelRequest,
  canEditRequest,
  canRetryRequest,
} from '../../src/domain/policy';
import { AuthUser, Role, Status } from '../../src/types';

describe('Domain: Policy Authorization', () => {
  const operator1: AuthUser = {
    id: 'op-1',
    role: Role.OPERATOR,
    email: 'op1@example.com',
    name: 'Operator One',
  };

  const operator2: AuthUser = {
    id: 'op-2',
    role: Role.OPERATOR,
    email: 'op2@example.com',
    name: 'Operator Two',
  };

  const supervisor: AuthUser = {
    id: 'sup-1',
    role: Role.SUPERVISOR,
    email: 'supervisor@example.com',
    name: 'Supervisor User',
  };

  const admin: AuthUser = {
    id: 'admin-1',
    role: Role.ADMIN,
    email: 'admin@example.com',
    name: 'Admin User',
  };

  describe('canViewRequest', () => {
    const ownRequest = { createdById: operator1.id, assignedToId: null };
    const otherRequest = { createdById: operator2.id, assignedToId: null };

    it('allows SUPERVISOR to view any request', () => {
      expect(canViewRequest(supervisor, ownRequest)).toBe(true);
      expect(canViewRequest(supervisor, otherRequest)).toBe(true);
    });

    it('allows ADMIN to view any request', () => {
      expect(canViewRequest(admin, ownRequest)).toBe(true);
      expect(canViewRequest(admin, otherRequest)).toBe(true);
    });

    it('allows OPERATOR to view own request', () => {
      expect(canViewRequest(operator1, ownRequest)).toBe(true);
      expect(canViewRequest(operator2, otherRequest)).toBe(true);
    });

    it("does NOT allow OPERATOR to view another operator's request", () => {
      expect(canViewRequest(operator1, otherRequest)).toBe(false);
      expect(canViewRequest(operator2, ownRequest)).toBe(false);
    });
  });

  describe('canCancelRequest', () => {
    it('allows OPERATOR to cancel own cancelable request', () => {
      const cancelableStatuses = [Status.SUBMITTED, Status.QUEUED, Status.IN_PROGRESS];
      for (const status of cancelableStatuses) {
        expect(canCancelRequest(operator1, { createdById: operator1.id, status })).toBe(true);
      }
    });

    it('does NOT allow OPERATOR to cancel completed, cancelled or failed request', () => {
      expect(canCancelRequest(operator1, { createdById: operator1.id, status: Status.COMPLETED })).toBe(
        false,
      );
      expect(canCancelRequest(operator1, { createdById: operator1.id, status: Status.CANCELLED })).toBe(
        false,
      );
      expect(canCancelRequest(operator1, { createdById: operator1.id, status: Status.FAILED })).toBe(
        false,
      );
    });

    it("does NOT allow OPERATOR to cancel another's request even if cancelable", () => {
      expect(canCancelRequest(operator1, { createdById: operator2.id, status: Status.SUBMITTED })).toBe(
        false,
      );
      expect(canCancelRequest(operator1, { createdById: operator2.id, status: Status.QUEUED })).toBe(
        false,
      );
      expect(canCancelRequest(operator1, { createdById: operator2.id, status: Status.IN_PROGRESS })).toBe(
        false,
      );
    });

    it('allows SUPERVISOR and ADMIN to cancel any cancelable request', () => {
      const cancelableStatuses = [Status.SUBMITTED, Status.QUEUED, Status.IN_PROGRESS];
      for (const status of cancelableStatuses) {
        expect(canCancelRequest(supervisor, { createdById: operator2.id, status })).toBe(true);
        expect(canCancelRequest(admin, { createdById: operator2.id, status })).toBe(true);
      }
    });

    it('does NOT allow SUPERVISOR or ADMIN to cancel non-cancelable requests', () => {
      const nonCancelableStatuses = [Status.COMPLETED, Status.CANCELLED, Status.FAILED];
      for (const status of nonCancelableStatuses) {
        expect(canCancelRequest(supervisor, { createdById: operator1.id, status })).toBe(false);
        expect(canCancelRequest(admin, { createdById: operator1.id, status })).toBe(false);
      }
    });
  });

  describe('canEditRequest', () => {
    it('allows SUPERVISOR and ADMIN to edit', () => {
      expect(canEditRequest(supervisor)).toBe(true);
      expect(canEditRequest(admin)).toBe(true);
    });

    it('does NOT allow OPERATOR to edit', () => {
      expect(canEditRequest(operator1)).toBe(false);
      expect(canEditRequest(operator2)).toBe(false);
    });
  });

  describe('canRetryRequest', () => {
    it('allows SUPERVISOR and ADMIN to retry FAILED request', () => {
      expect(canRetryRequest(supervisor, { status: Status.FAILED })).toBe(true);
      expect(canRetryRequest(admin, { status: Status.FAILED })).toBe(true);
    });

    it('does NOT allow SUPERVISOR or ADMIN to retry COMPLETED request', () => {
      expect(canRetryRequest(supervisor, { status: Status.COMPLETED })).toBe(false);
      expect(canRetryRequest(admin, { status: Status.COMPLETED })).toBe(false);
    });

    it('does NOT allow SUPERVISOR or ADMIN to retry active requests', () => {
      expect(canRetryRequest(supervisor, { status: Status.SUBMITTED })).toBe(false);
      expect(canRetryRequest(supervisor, { status: Status.QUEUED })).toBe(false);
      expect(canRetryRequest(supervisor, { status: Status.IN_PROGRESS })).toBe(false);
      expect(canRetryRequest(supervisor, { status: Status.CANCELLED })).toBe(false);
    });

    it('does NOT allow OPERATOR to retry any request', () => {
      expect(canRetryRequest(operator1, { status: Status.FAILED })).toBe(false);
      expect(canRetryRequest(operator1, { status: Status.COMPLETED })).toBe(false);
      expect(canRetryRequest(operator2, { status: Status.FAILED })).toBe(false);
    });
  });
});
