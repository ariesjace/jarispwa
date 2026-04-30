import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type WhereOperator =
  | "<"
  | "<="
  | "=="
  | "!="
  | ">="
  | ">"
  | "array-contains"
  | "in"
  | "array-contains-any"
  | "not-in";

export interface CmsWhereClause {
  field: string;
  op: WhereOperator;
  value: unknown;
}

export interface CmsPageOptions {
  collectionName: string;
  orderByField: string;
  orderDirection?: "asc" | "desc";
  pageSize?: number;
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
  whereClauses?: CmsWhereClause[];
}

export interface CmsPageResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

export function normalizePageSize(pageSize?: number): number {
  if (!pageSize || Number.isNaN(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.max(10, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

export async function fetchCmsCollectionPage<T = Record<string, unknown>>(
  options: CmsPageOptions,
): Promise<CmsPageResult<T>> {
  const {
    collectionName,
    orderByField,
    orderDirection = "desc",
    pageSize,
    startAfterDoc = null,
    whereClauses = [],
  } = options;

  const take = normalizePageSize(pageSize);
  const constraints: QueryConstraint[] = [];

  for (const clause of whereClauses) {
    constraints.push(where(clause.field, clause.op, clause.value));
  }

  constraints.push(orderBy(orderByField, orderDirection));

  if (startAfterDoc) {
    constraints.push(startAfter(startAfterDoc));
  }

  constraints.push(limit(take));

  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);

  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return {
    items,
    lastDoc,
    hasMore: snap.docs.length === take,
  };
}
