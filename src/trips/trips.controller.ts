import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AddTripProductDto } from './dto/add-trip-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @Get()
  findAll() {
    return this.tripsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @Post(':id/start')
  startTrip(@Param('id') id: string) {
    return this.tripsService.startTrip(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }

  @Post(':id/products')
  addProduct(@Param('id') tripId: string, @Body() dto: AddTripProductDto) {
    return this.tripsService.addProduct(tripId, dto);
  }

  @Get(':id/products')
  findProducts(@Param('id') tripId: string) {
    return this.tripsService.findProducts(tripId);
  }

  @Delete(':id/products/:tripProductId')
  removeProduct(
    @Param('id') tripId: string,
    @Param('tripProductId') tripProductId: string,
  ) {
    return this.tripsService.removeProduct(tripId, tripProductId);
  }
}