import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { CategoryQueryDto } from './dto/category-query.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { MessageCodes } from '../../common/constants/message-codes.const';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage(
    MessageCodes.CATEGORY_CREATED,
    'Category created successfully',
  )
  @ApiOperation({ summary: 'Create a new category (ADMIN only)' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @Public()
  @ResponseMessage(
    MessageCodes.CATEGORIES_RETRIEVED,
    'Categories retrieved successfully',
  )
  @ApiOperation({ summary: 'Get all categories' })
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ResponseMessage(MessageCodes.CATEGORY_RETRIEVED, 'Category retrieved')
  @ApiOperation({ summary: 'Get a category by id' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.CATEGORY_UPDATED,
    'Category updated successfully',
  )
  @ApiOperation({ summary: 'Update a category (ADMIN only)' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.CATEGORY_DELETED,
    'Category deleted successfully',
  )
  @ApiOperation({ summary: 'Delete a category (ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
