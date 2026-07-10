import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
  it('should attach isPublic metadata to the handler', () => {
    class TestController {
      @Public()
      someMethod(this: void) {}
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.someMethod,
    ) as boolean;
    expect(metadata).toBe(true);
  });
});
