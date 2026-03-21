import { getDb } from '../../db/sqlite';

export type WorkspaceProfile = {
  id: number;
  company_name: string;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveWorkspaceProfileInput = {
  companyName: string;
  branchName?: string | null;
};

const ACTIVE_WORKSPACE_ID = 1;

function normalizeCompanyName(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeBranchName(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function getWorkspaceDisplayName(
  workspace: Pick<WorkspaceProfile, 'company_name' | 'branch_name'> | null | undefined,
) {
  const companyName = normalizeCompanyName(workspace?.company_name);

  if (!companyName) {
    return null;
  }

  const branchName = normalizeBranchName(workspace?.branch_name);

  return branchName ? `${companyName} / ${branchName}` : companyName;
}

export async function getWorkspaceProfile() {
  const db = await getDb();

  return db.getFirstAsync<WorkspaceProfile>(
    `
      SELECT
        id,
        company_name,
        branch_name,
        created_at,
        updated_at
      FROM workspace_profiles
      WHERE id = ?
    `,
    ACTIVE_WORKSPACE_ID,
  );
}

export async function saveWorkspaceProfile(input: SaveWorkspaceProfileInput) {
  const companyName = normalizeCompanyName(input.companyName);

  if (!companyName) {
    throw new Error('Kurumsal kütüphane için şirket adı gerekli.');
  }

  const branchName = normalizeBranchName(input.branchName);
  const db = await getDb();
  const existing = await getWorkspaceProfile();
  const now = new Date().toISOString();

  if (existing) {
    await db.runAsync(
      `
        UPDATE workspace_profiles
        SET
          company_name = ?,
          branch_name = ?,
          updated_at = ?
        WHERE id = ?
      `,
      companyName,
      branchName,
      now,
      ACTIVE_WORKSPACE_ID,
    );
  } else {
    await db.runAsync(
      `
        INSERT INTO workspace_profiles (
          id,
          company_name,
          branch_name,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      ACTIVE_WORKSPACE_ID,
      companyName,
      branchName,
      now,
      now,
    );
  }

  const workspace = await getWorkspaceProfile();

  if (!workspace) {
    throw new Error('Şirket profili kaydedildikten sonra okunamadı.');
  }

  return workspace;
}

export const workspaceService = {
  getWorkspaceProfile,
  saveWorkspaceProfile,
  getWorkspaceDisplayName,
};
