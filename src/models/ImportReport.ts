/**
 * @file src/models/ImportReport.ts
 * @desc The imports collection's Mongoose schema: one row per real import run (counts, skipped
 *       pools, the map fill, the sync, the stats backfill, whether it ended well, and the printed
 *       report), newest first for /admin. importsCollection() hands out the typed collection.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Collection, WithId } from "mongodb";
import { type Model, Schema } from "mongoose";
import { IMPORTS_COLLECTION } from "@/constants/db";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { ImportReportRow } from "@/utils/import-report";

/** A stored report: the row plus the ObjectId MongoDB gave it on insert. */
export type StoredImportReport = WithId<ImportReportRow>;

const importSchema = new Schema(
  {
    source: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    read: { type: Number, required: true },
    counts: { type: Schema.Types.Mixed, required: true },
    skipped: { type: [Schema.Types.Mixed], default: [] },
    maps: { type: Schema.Types.Mixed, default: null },
    sync: { type: Schema.Types.Mixed, default: null },
    stats: { type: Schema.Types.Mixed, default: null },
    ok: { type: Boolean, required: true },
    text: { type: String, required: true },
  },
  { collection: IMPORTS_COLLECTION, versionKey: false },
);

importSchema.index({ startedAt: -1 }, { name: "startedAt_-1" });

/**
 * @function getImportReportModel
 * @returns {Model<StoredImportReport>} the ImportReport model on the shared connection
 */
export const getImportReportModel = (): Model<StoredImportReport> => {
  const connection = getModelConnection();
  return (
    (connection.models.ImportReport as Model<StoredImportReport> | undefined) ??
    connection.model<StoredImportReport>("ImportReport", importSchema)
  );
};

/**
 * @function importsCollection
 * @returns {Promise<Collection<ImportReportRow>>} the imports collection once indexed; typed on
 *          the row without _id, so insertOne takes a new row and reads come back WithId
 */
export const importsCollection = async (): Promise<Collection<ImportReportRow>> => {
  await connectDb();
  await getImportReportModel().init();
  return getDb().collection<ImportReportRow>(IMPORTS_COLLECTION);
};
