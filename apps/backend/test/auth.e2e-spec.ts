import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e-test' } } });
    await app.close();
  });

  describe('/api/v1/auth/register (POST)', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test@example.com',
          username: 'e2etestuser',
          password: 'Test@123456',
          region: 'USD',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Registration successful');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test@example.com',
          username: 'anotheruser',
          password: 'Test@123456',
        });

      expect(res.status).toBe(409);
    });

    it('should reject weak passwords', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test2@example.com',
          username: 'e2etestuser2',
          password: 'weakpassword',
        });

      expect(res.status).toBe(400);
    });
  });
});
