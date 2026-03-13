import { PartialType } from '@nestjs/swagger';
import { AdminCreatePatientDto } from './create-patient.dto';

export class AdminUpdatePatientDto extends PartialType(AdminCreatePatientDto) {}
