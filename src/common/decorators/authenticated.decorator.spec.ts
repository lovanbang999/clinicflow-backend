import { Authenticated, IS_AUTHENTICATED_KEY } from './authenticated.decorator';

describe('Authenticated Decorator', () => {
  it('should attach isAuthenticatedOnly metadata to the handler', () => {
    class TestController {
      @Authenticated()
      someMethod(this: void) {}
    }

    const metadata = Reflect.getMetadata(
      IS_AUTHENTICATED_KEY,
      TestController.prototype.someMethod,
    ) as boolean;
    expect(metadata).toBe(true);
  });
});
