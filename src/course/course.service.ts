import { Injectable, Logger } from '@nestjs/common';
import { Course, Prisma, Session } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  private logger = new Logger(CourseService.name);

  public async getCourse(
    courseWhereUniqueInput: Prisma.CourseWhereUniqueInput,
  ): Promise<Course | null> {
    this.logger.verbose('courseById', courseWhereUniqueInput);

    return this.prisma.course.findUnique({
      where: courseWhereUniqueInput,
    });
  }

  private async getCoursesByIds(
    courseIds: number[],
  ): Promise<Map<number, Course>> {
    const existingCourses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
    });

    return new Map(existingCourses.map((course) => [course.id, course]));
  }

  public async getAllCourses() {
    this.logger.verbose('getAllCourses');

    return this.prisma.course.findMany();
  }

  public async getCoursesByProgram(programId: number): Promise<Course[]> {
    this.logger.verbose('getCoursesByProgram', programId);

    return this.prisma.course.findMany({
      where: {
        programs: {
          some: {
            programId,
          },
        },
      },
    });
  }

  public async getCourseAvailability(
    courseId: number,
  ): Promise<{ session: Session; available: boolean }[]> {
    this.logger.verbose('getCourseAvailability', courseId);

    const courseInstances = await this.prisma.courseInstance.findMany({
      where: { courseId },
      include: {
        session: true,
      },
    });

    const sessionAvailability = courseInstances.map((ci) => ({
      session: ci.session,
      available: true,
    }));

    return sessionAvailability;
  }

  public async createCourse(data: Prisma.CourseCreateInput): Promise<Course> {
    this.logger.verbose('Creating course: ' + data.code);

    const course = await this.prisma.course.create({
      data: {
        ...data,
        createdAt: new Date(),
      },
    });

    return course;
  }

  public async updateCourse(params: {
    where: Prisma.CourseWhereUniqueInput;
    data: Prisma.CourseUpdateInput;
  }): Promise<Course> {
    const { data, where } = params;

    this.logger.verbose('Updating course: ' + data.code);
    return this.prisma.course.update({
      data: {
        ...data,
        updatedAt: new Date(),
      },
      where,
    });
  }

  public async upsertCourses(
    data: Prisma.CourseCreateInput[],
  ): Promise<Course[]> {
    this.logger.verbose('upsertCourses');

    const existingCourses = await this.getCoursesByIds(
      data.map((course) => course.id),
    );
    const operations = this.prepareUpsertCourses(data, existingCourses);

    return Promise.all([...operations.updates, ...operations.creations]);
  }

  private prepareUpsertCourses(
    data: Prisma.CourseCreateInput[],
    existingCourses: Map<number, Course>,
  ): {
    updates: Array<Promise<Course>>;
    creations: Array<Promise<Course>>;
  } {
    const updates: Array<Promise<Course>> = [];
    const creations: Array<Promise<Course>> = [];

    data.forEach((courseData) => {
      const existingCourse = existingCourses.get(courseData.id);

      if (existingCourse) {
        const hasChanges = this.hasCourseChanged(existingCourse, courseData);
        if (hasChanges) {
          updates.push(
            this.updateCourse({
              where: { id: courseData.id },
              data: courseData,
            }),
          );
        } else {
          updates.push(Promise.resolve(existingCourse));
        }
      } else {
        creations.push(this.createCourse(courseData));
      }
    });

    return { updates, creations };
  }

  private hasCourseChanged(
    existingCourse: Course,
    courseData: Prisma.CourseCreateInput,
  ): boolean {
    //existing course data without the createdAt and updatedAt field
    const normalizedExistingCourse = {
      id: existingCourse.id,
      code: existingCourse.code,
      title: existingCourse.title,
      description: existingCourse.description,
      credits: existingCourse.credits,
      cycle: existingCourse.cycle,
    };

    const normalizedCourseData = {
      id: courseData.id,
      code: courseData.code,
      title: courseData.title,
      description: courseData.description,
      credits: courseData.credits,
      cycle: courseData.cycle,
    };

    return (
      JSON.stringify(normalizedExistingCourse) !==
      JSON.stringify(normalizedCourseData)
    );
  }

  public async deleteCourse(
    where: Prisma.CourseWhereUniqueInput,
  ): Promise<Course> {
    this.logger.verbose('deleteCourse', where);

    return this.prisma.course.delete({
      where,
    });
  }
}
