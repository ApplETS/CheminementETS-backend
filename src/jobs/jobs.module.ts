import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CheminotModule } from '../common/api-helper/cheminot/cheminot.module';
import { EtsModule } from '../common/api-helper/ets/ets.module';
import { CourseModule } from '../course/course.module';
import { ProgramModule } from '../program/program.module';
import { ProgramCourseModule } from '../program-course/program-course.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CoursesJobService } from './workers/courses.worker';
import { ProgramsJobService } from './workers/programs.worker';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EtsModule,
    ProgramModule,
    CourseModule,
    ProgramCourseModule,
    CheminotModule,
  ],
  providers: [JobsService, ProgramsJobService, CoursesJobService],
  controllers: process.env.NODE_ENV === 'development' ? [JobsController] : [],
})
export class JobsModule {}
