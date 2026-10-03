import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlAuthGuard } from './gql-auth.guard';

/**
 * For operations that are public by default: lets anonymous requests through
 * unless the instance requires sign-in (REQUIRE_LOGIN), then behaves like GqlAuthGuard.
 */
@Injectable()
export class GqlLoginRequiredGuard extends GqlAuthGuard {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.configService.get<string>('INFRA.REQUIRE_LOGIN') !== 'true') {
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
