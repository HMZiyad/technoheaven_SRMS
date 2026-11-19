import { describe, it, expect } from 'vitest';
import { assertTransition, isTerminal, canCancel } from '../../src/domain/stateMachine';
import { Status } from '../../src/types';
import { InvalidTransitionError } from '../../src/utils/errors';

describe('Domain: State Machine', () => {
  describe('assertTransition - valid transitions', () => {
    it('allows SUBMITTED -> QUEUED and SUBMITTED -> CANCELLED', () => {
      expect(() => assertTransition(Status.SUBMITTED, Status.QUEUED)).not.toThrow();
      expect(() => assertTransition(Status.SUBMITTED, Status.CANCELLED)).not.toThrow();
    });

    it('allows QUEUED -> IN_PROGRESS and QUEUED -> CANCELLED', () => {
      expect(() => assertTransition(Status.QUEUED, Status.IN_PROGRESS)).not.toThrow();
      expect(() => assertTransition(Status.QUEUED, Status.CANCELLED)).not.toThrow();
    });

    it('allows IN_PROGRESS -> COMPLETED, IN_PROGRESS -> FAILED, and IN_PROGRESS -> CANCELLED', () => {
      expect(() => assertTransition(Status.IN_PROGRESS, Status.COMPLETED)).not.toThrow();
      expect(() => assertTransition(Status.IN_PROGRESS, Status.FAILED)).not.toThrow();
      expect(() => assertTransition(Status.IN_PROGRESS, Status.CANCELLED)).not.toThrow();
    });

    it('allows FAILED -> QUEUED', () => {
      expect(() => assertTransition(Status.FAILED, Status.QUEUED)).not.toThrow();
    });
  });

  describe('assertTransition - invalid transitions', () => {
    it('throws InvalidTransitionError for SUBMITTED -> COMPLETED', () => {
      expect(() => assertTransition(Status.SUBMITTED, Status.COMPLETED)).toThrow(
        InvalidTransitionError,
      );
    });

    it('throws InvalidTransitionError for QUEUED -> COMPLETED', () => {
      expect(() => assertTransition(Status.QUEUED, Status.COMPLETED)).toThrow(
        InvalidTransitionError,
      );
    });

    it('throws InvalidTransitionError for COMPLETED -> anything', () => {
      const allStatuses = Object.values(Status);
      for (const target of allStatuses) {
        expect(() => assertTransition(Status.COMPLETED, target)).toThrow(InvalidTransitionError);
      }
    });

    it('throws InvalidTransitionError for CANCELLED -> anything', () => {
      const allStatuses = Object.values(Status);
      for (const target of allStatuses) {
        expect(() => assertTransition(Status.CANCELLED, target)).toThrow(InvalidTransitionError);
      }
    });

    it('throws InvalidTransitionError for FAILED -> COMPLETED', () => {
      expect(() => assertTransition(Status.FAILED, Status.COMPLETED)).toThrow(
        InvalidTransitionError,
      );
    });

    it('includes from and to in InvalidTransitionError', () => {
      try {
        assertTransition(Status.SUBMITTED, Status.COMPLETED);
        expect.fail('Should have thrown InvalidTransitionError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidTransitionError);
        expect(err.from).toBe(Status.SUBMITTED);
        expect(err.to).toBe(Status.COMPLETED);
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('isTerminal helper', () => {
    it('returns true for COMPLETED and CANCELLED', () => {
      expect(isTerminal(Status.COMPLETED)).toBe(true);
      expect(isTerminal(Status.CANCELLED)).toBe(true);
    });

    it('returns false for active/transitional states', () => {
      expect(isTerminal(Status.SUBMITTED)).toBe(false);
      expect(isTerminal(Status.QUEUED)).toBe(false);
      expect(isTerminal(Status.IN_PROGRESS)).toBe(false);
      expect(isTerminal(Status.FAILED)).toBe(false);
    });
  });

  describe('canCancel helper', () => {
    it('returns true for SUBMITTED, QUEUED, and IN_PROGRESS', () => {
      expect(canCancel(Status.SUBMITTED)).toBe(true);
      expect(canCancel(Status.QUEUED)).toBe(true);
      expect(canCancel(Status.IN_PROGRESS)).toBe(true);
    });

    it('returns false for COMPLETED, FAILED, and CANCELLED', () => {
      expect(canCancel(Status.COMPLETED)).toBe(false);
      expect(canCancel(Status.FAILED)).toBe(false);
      expect(canCancel(Status.CANCELLED)).toBe(false);
    });
  });
});
