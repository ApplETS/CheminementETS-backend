import PDFParser, { Output } from 'pdf2json';
import { TextExtractor } from './textExtractorUtil';

export class PdfParserUtil {
  public static async parsePdfBuffer(
    pdfBuffer: Buffer,
    processData: (pdfData: Output) => any,
  ): Promise<any> {
    const parser = new PDFParser();

    return new Promise((resolve, reject) => {
      parser.on('pdfParser_dataError', (errData) => console.error(errData));
      parser.on('pdfParser_dataReady', async (pdfData) => {
        try {
          const result = await processData(pdfData);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      parser.parseBuffer(pdfBuffer);
    });
  }
}
