import { Roles, ROLES_KEY } from './roles.decorator';
import { UserRole } from '@prisma/client';

describe('Roles Decorator', () => {
  it('should attach roles metadata to the handler', () => {
    class TestController {
      @Roles(UserRole.DOCTOR, UserRole.ADMIN)
      someMethod(this: void) {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.someMethod,
    ) as UserRole[];
    expect(metadata).toEqual([UserRole.DOCTOR, UserRole.ADMIN]);
  });
});
