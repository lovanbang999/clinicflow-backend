export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  messageCode: string;
  data?: T;
  errorMessage?: string;
  errorCode?: string;
  timestamp: string;
}

export class ResponseHelper {
  static success<T>(
    data: T,
    messageCode: string = 'SUCCESS',
    message: string = 'Operation successful',
    statusCode: number = 200,
  ): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      message,
      messageCode,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(
    errorCode: string,
    errorMessage: string,
    statusCode: number = 400,
    message: string = 'Operation failed',
  ): ApiResponse {
    return {
      success: false,
      statusCode,
      message,
      messageCode: errorCode,
      errorMessage,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }
}
