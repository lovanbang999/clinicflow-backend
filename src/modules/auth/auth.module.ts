import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';

@Module({
  imports: [],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
