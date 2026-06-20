import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SequenceService } from '../database/services/sequence.service';
import { RedisService } from '../database/services/redis.service';
import { MailService } from '../notifications/mail.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: 'IUserRepository',
          useValue: {},
        },
        {
          provide: 'IProfileRepository',
          useValue: {},
        },
        {
          provide: 'IBookingRepository',
          useValue: {},
        },
        {
          provide: SequenceService,
          useValue: {
            generateNextSequence: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            isReady: jest.fn().mockReturnValue(false),
            getJson: jest.fn(),
            setJson: jest.fn(),
            delPattern: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
