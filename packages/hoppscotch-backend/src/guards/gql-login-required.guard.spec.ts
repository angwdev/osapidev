import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';
import { GqlAuthGuard } from './gql-auth.guard';
import { GqlLoginRequiredGuard } from './gql-login-required.guard';

const context = mockDeep<ExecutionContext>();

const guardWith = (requireLogin: string | undefined) => {
  const configService = mockDeep<ConfigService>();
  configService.get.mockReturnValue(requireLogin);
  return new GqlLoginRequiredGuard(configService);
};

describe('GqlLoginRequiredGuard', () => {
  let authCanActivate: jest.SpyInstance;

  beforeEach(() => {
    authCanActivate = jest
      .spyOn(GqlAuthGuard.prototype, 'canActivate')
      .mockResolvedValue(false);
  });

  afterEach(() => authCanActivate.mockRestore());

  test.each([undefined, 'false'])(
    'lets anonymous requests through when REQUIRE_LOGIN is %p',
    async (value) => {
      await expect(guardWith(value).canActivate(context)).resolves.toBe(true);
      expect(authCanActivate).not.toHaveBeenCalled();
    },
  );

  test('requires authentication when REQUIRE_LOGIN is true', async () => {
    await expect(guardWith('true').canActivate(context)).resolves.toBe(false);
    expect(authCanActivate).toHaveBeenCalledWith(context);
  });
});
