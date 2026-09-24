/**
 * @file src/services/imports.ts
 * @desc Import reports: the runner stores one per real run; /admin lists the newest.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { QUERY_TIME_MS } from "@/constants/db";
import { importsCollection, type StoredImportReport } from "@/models/ImportReport";
import type { ImportReportRow } from "@/utils/import-report";

/**
 * @function writeImportReport
 * @param row {ImportReportRow} one run's report
 * @returns {Promise<string>} the stored row's id
 */
export const writeImportReport = async (row: ImportReportRow): Promise<string> => {
  const imports = await importsCollection();
  const result = await imports.insertOne({ ...row });
  return result.insertedId.toHexString();
};

/**
 * @function listImportReports
 * @param limit {number} how many (default 20)
 * @returns {Promise<StoredImportReport[]>} the newest reports first
 */
export const listImportReports = async (limit = 20): Promise<StoredImportReport[]> => {
  const imports = await importsCollection();
  return imports.find({}, { sort: { startedAt: -1 }, limit, maxTimeMS: QUERY_TIME_MS }).toArray();
};
