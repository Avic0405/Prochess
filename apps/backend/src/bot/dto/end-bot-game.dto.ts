import { IsString, IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndBotGameDto {
  @ApiProperty({ example: 'clx1y2z3a0000abcd1234efgh' })
  @IsString()
  levelId: string;

  @ApiProperty({ example: 'WIN', enum: ['WIN', 'LOSS', 'DRAW', 'ABANDONED'] })
  @IsIn(['WIN', 'LOSS', 'DRAW', 'ABANDONED'])
  result: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pgn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fen?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  moveCount?: number;
}
