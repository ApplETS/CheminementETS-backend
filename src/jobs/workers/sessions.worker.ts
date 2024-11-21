import { Injectable, Logger } from '@nestjs/common';
import { Program, Session } from '@prisma/client';

import { getHorairePdfUrl } from '../../common/constants/url';
import { CourseCodeValidationPipe } from '../../common/pipes/models/course/course-code-validation-pipe';
import { parsePrerequisiteString } from '../../common/utils/prerequisite/prerequisiteUtil';
import { getTrimesterIndexBySession } from '../../common/utils/session/sessionUtil';
import { HoraireCoursService } from '../../common/website-helper/pdf/pdf-parser/horaire/horaire-cours.service';
import { IHoraireCours } from '../../common/website-helper/pdf/pdf-parser/horaire/horaire-cours.types';
import { CourseService } from '../../course/course.service';
import { PrerequisiteService } from '../../prerequisite/prerequisite.service';
import { ProgramService } from '../../program/program.service';
import { ProgramCourseService } from '../../program-course/program-course.service';
import { SessionService } from '../../session/session.service';

@Injectable()
export class SessionsJobService {
  private readonly logger = new Logger(SessionsJobService.name);

  private unstructuredPrerequisitesUpdated = 0;
  private prerequisitesAdded = 0;

  constructor(
    private readonly sessionService: SessionService,
    private readonly programService: ProgramService,
    private readonly horaireCoursService: HoraireCoursService,
    private readonly courseService: CourseService,
    private readonly programCourseService: ProgramCourseService,
    private readonly prerequisiteService: PrerequisiteService,
    private readonly courseCodeValidationPipe: CourseCodeValidationPipe,
  ) {}

  /**
   * Main method to process prerequisites, using the current session data in Horaire-cours PDF.
   */
  public async processSessions(): Promise<void> {
    this.logger.log('Starting processSessions job.');

    try {
      const currentSession =
        await this.sessionService.getOrCreateCurrentSession();
      this.logger.log(
        `Current session: Year ${currentSession.year}, Trimester ${currentSession.trimester}`,
      );

      const eligiblePrograms =
        await this.programService.getProgramsByHoraireParsablePDF();
      this.logger.log(
        `Found ${eligiblePrograms.length} programs with horaireParsablePdf = true.`,
      );

      for (const program of eligiblePrograms) {
        await this.processProgram(currentSession, program);
      }

      // Log total counts
      this.logger.log(
        `Total unstructured prerequisites updated: ${this.unstructuredPrerequisitesUpdated}`,
      );
      this.logger.log(`Total prerequisites added: ${this.prerequisitesAdded}`);
    } catch (error) {
      this.logger.error('Error in processSessions job:', error);
    }
  }

  private async processProgram(
    session: Session,
    program: Program,
  ): Promise<void> {
    const { code: programCode } = program;
    this.logger.log(`Processing program: ${programCode}`);

    if (!programCode) {
      throw new Error(
        `Program code is null for program: ${JSON.stringify(program)}`,
      );
    }

    try {
      // a. Generate Horaire PDF URL
      const horairePdfUrl = getHorairePdfUrl(
        `${session.year}${getTrimesterIndexBySession(session.trimester)}`,
        programCode,
      );

      // b. Fetch and parse Horaire PDF
      const parsedCourses =
        await this.horaireCoursService.parsePdfFromUrl(horairePdfUrl);
      this.logger.log(
        `Parsed ${parsedCourses.length} courses for program ${programCode}.`,
      );

      // c. Handle parsed data
      await this.handleParsedCourses(program, parsedCourses);
      this.logger.log(`Saved parsed courses for program ${programCode}.`);
    } catch (error) {
      this.logger.error(`Error processing program ${programCode}:`, error);
    }
  }

  private async handleParsedCourses(
    program: Program,
    courses: IHoraireCours[],
  ): Promise<void> {
    for (const course of courses) {
      await this.processPrerequisites(course, program);
    }
  }

  private async processPrerequisites(
    coursePdf: IHoraireCours,
    program: Program,
  ): Promise<void> {
    const existingCourse = await this.courseService.getCourseByCode(
      coursePdf.code,
    );
    if (!existingCourse) {
      this.logger.error(`Course not found in database: ${coursePdf.code}`);
      return;
    }

    const programCourse =
      await this.programCourseService.getProgramCourseWithPrerequisites({
        courseId_programId: {
          courseId: existingCourse.id,
          programId: program.id,
        },
      });

    if (!programCourse) {
      return;
    }

    if (!coursePdf.prerequisites || coursePdf.prerequisites.trim() === '') {
      return;
    }

    const parsedPrerequisites = parsePrerequisiteString(
      coursePdf.prerequisites,
      this.courseCodeValidationPipe,
    );

    this.logger.debug(
      `Unstructured prerequisites for course ${coursePdf.code}: "${coursePdf.prerequisites}"`,
    );
    const updatedUnstructPrereqCount =
      await this.prerequisiteService.updateUnstructuredPrerequisite(
        programCourse,
        coursePdf.prerequisites,
      );

    this.unstructuredPrerequisitesUpdated += updatedUnstructPrereqCount;

    if (!parsedPrerequisites) {
      return;
    }

    for (const prerequisiteCode of parsedPrerequisites) {
      const wasAdded =
        await this.prerequisiteService.addPrerequisiteIfNotExists(
          programCourse,
          prerequisiteCode,
          program,
        );
      if (wasAdded) {
        this.prerequisitesAdded += 1;
      }
    }
  }
}
