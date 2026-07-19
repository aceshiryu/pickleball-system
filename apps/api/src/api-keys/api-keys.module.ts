import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

/**
 * Global because ApiAuthGuard is referenced by @UseGuards in several feature
 * modules, and Nest resolves guard classes through the injector of whichever
 * module uses them. Without @Global every one of those modules would have to
 * import this one.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
