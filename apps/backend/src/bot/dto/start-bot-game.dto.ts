import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartBotGameDto {
  @ApiProperty({ example: 'clx1y2z3a0000abcd1234efgh' })
  @IsString()
  levelId: string;
}
