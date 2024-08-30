import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EtsCourseService } from '../../common/api-helper/ets/course/ets-course.service';
import { CourseService } from '../../course/course.service';
import { QueuesEnum } from '../queues.enum';

@Processor(QueuesEnum.COURSES)
export class CoursesProcessor extends WorkerHost {
  private logger = new Logger(CoursesProcessor.name);

  constructor(
    private readonly etsCourseService: EtsCourseService,
    private readonly courseService: CourseService,
  ) {
    super();
  }

  public async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'courses-upsert':
        await this.processCourses(job);
        break;
      case 'course-availability':
        //TOOD: Implement
        break;
      case 'course-prerequisites':
        //TOOD: Implement
        break;
      default:
        this.logger.error('Unknown job name: ' + job.name);
    }
  }

  private async processCourses(job: Job): Promise<void> {
    this.logger.log('Processing courses...');

    try {
      const courses = await this.etsCourseService.fetchAllCoursesWithCredits();

      const coursesLength = courses.length;

      if (!coursesLength) {
        this.logger.error('No courses fetched.');
        throw new Error('No courses fetched.');
      }

      this.logger.log(`${coursesLength} courses fetched.`);

      await this.courseService.upsertCourses(courses);

      job.updateProgress(100);

      job.updateData({
        processed: true,
        courses: courses.length,
      });
    } catch (error: unknown) {
      this.logger.error('Error processing courses: ', error);
      throw error;
    }
  }
}
