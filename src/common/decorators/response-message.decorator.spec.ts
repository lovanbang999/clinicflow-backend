import {
  ResponseMessage,
  RESPONSE_MESSAGE_METADATA,
} from './response-message.decorator';
import { MessageCodes } from '../constants/message-codes.const';

interface ResponseMessageMeta {
  messageCode: string;
  message: string;
}

describe('ResponseMessage Decorator', () => {
  it('should attach response message metadata to the handler', () => {
    class TestController {
      @ResponseMessage(
        MessageCodes.LOGIN_SUCCESS,
        'User logged in successfully',
      )
      someMethod(this: void) {}
    }

    const metadata = Reflect.getMetadata(
      RESPONSE_MESSAGE_METADATA,
      TestController.prototype.someMethod,
    ) as ResponseMessageMeta;
    expect(metadata).toEqual({
      messageCode: MessageCodes.LOGIN_SUCCESS,
      message: 'User logged in successfully',
    });
  });
});
