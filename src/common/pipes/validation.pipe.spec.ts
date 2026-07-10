import { ValidationPipe } from './validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsString, IsNumber } from 'class-validator';

class TestDto {
  @IsString()
  name: string;

  @IsNumber()
  age: number;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;
  let metadata: ArgumentMetadata;

  beforeEach(() => {
    pipe = new ValidationPipe();
    metadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should pass if the validation succeeds', async () => {
    const target = { name: 'SmartClinic', age: 5 };
    const result = (await pipe.transform(target, metadata)) as TestDto;
    expect(result).toEqual(target);
  });

  it('should throw BadRequestException if validation fails', async () => {
    const target = { name: 12345, age: 'invalid-age' };
    await expect(pipe.transform(target, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should convert types implicitly due to enableImplicitConversion', async () => {
    const target = { name: 'SmartClinic', age: '10' };
    const result = (await pipe.transform(target, metadata)) as TestDto;
    expect(result).toEqual({ name: 'SmartClinic', age: 10 }); // '10' converted to 10
  });

  it('should throw BadRequestException if forbidNonWhitelisted is active and non-whitelisted field is present', async () => {
    const target = { name: 'SmartClinic', age: 10, unknownField: 'forbidden' };
    await expect(pipe.transform(target, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
