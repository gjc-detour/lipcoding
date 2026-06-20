import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

const UPLOADS_CONTAINER_NAME = "lipcoding-uploads";

interface StorageConnectionParts {
  AccountName?: string;
  AccountKey?: string;
  BlobEndpoint?: string;
  DefaultEndpointsProtocol?: string;
  EndpointSuffix?: string;
}

let blobServiceClient: BlobServiceClient | null = null;
let sharedKeyCredential: StorageSharedKeyCredential | null = null;
let containerInitPromise: Promise<void> | null = null;

function getStorageConnectionString(): string {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();

  if (!connectionString) {
    throw new Error(
      "Azure Blob Storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING."
    );
  }

  return connectionString;
}

function parseConnectionString(connectionString: string): StorageConnectionParts {
  return connectionString.split(";").reduce<StorageConnectionParts>((parts, segment) => {
    const [rawKey, ...rawValueParts] = segment.split("=");

    if (!rawKey || rawValueParts.length === 0) {
      return parts;
    }

    const key = rawKey.trim() as keyof StorageConnectionParts;
    const value = rawValueParts.join("=").trim();
    parts[key] = value;
    return parts;
  }, {});
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(getStorageConnectionString());
  }

  return blobServiceClient;
}

function getSharedKeyCredential(): StorageSharedKeyCredential | null {
  if (sharedKeyCredential) {
    return sharedKeyCredential;
  }

  const parsed = parseConnectionString(getStorageConnectionString());

  if (parsed.AccountName && parsed.AccountKey) {
    sharedKeyCredential = new StorageSharedKeyCredential(
      parsed.AccountName,
      parsed.AccountKey
    );
  }

  return sharedKeyCredential;
}

async function ensureUploadsContainer(): Promise<void> {
  if (containerInitPromise) {
    return containerInitPromise;
  }

  containerInitPromise = (async () => {
    const containerClient = getBlobServiceClient().getContainerClient(UPLOADS_CONTAINER_NAME);
    await containerClient.createIfNotExists();
  })().catch((error) => {
    containerInitPromise = null;
    throw error;
  });

  await containerInitPromise;
}

function getBlobName(userId: string, itemId: string, filename: string): string {
  return `${userId}/${itemId}/${filename}`;
}

export async function uploadBlob(
  userId: string,
  itemId: string,
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  await ensureUploadsContainer();
  const containerClient = getBlobServiceClient().getContainerClient(UPLOADS_CONTAINER_NAME);
  const blobClient = containerClient.getBlockBlobClient(
    getBlobName(userId, itemId, filename)
  );

  await blobClient.uploadData(buffer, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
  });

  return getBlobUrl(userId, itemId, filename);
}

export async function downloadBlob(
  userId: string,
  itemId: string,
  filename: string
): Promise<Buffer> {
  await ensureUploadsContainer();
  const containerClient = getBlobServiceClient().getContainerClient(UPLOADS_CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(getBlobName(userId, itemId, filename));
  return blobClient.downloadToBuffer();
}

export async function deleteBlob(
  userId: string,
  itemId: string,
  filename: string
): Promise<void> {
  await ensureUploadsContainer();
  const containerClient = getBlobServiceClient().getContainerClient(UPLOADS_CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(getBlobName(userId, itemId, filename));
  await blobClient.deleteIfExists();
}

export async function getBlobUrl(
  userId: string,
  itemId: string,
  filename: string
): Promise<string> {
  await ensureUploadsContainer();
  const containerClient = getBlobServiceClient().getContainerClient(UPLOADS_CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(getBlobName(userId, itemId, filename));
  const accessPolicy = await containerClient.getAccessPolicy();

  if (
    accessPolicy.blobPublicAccess === "blob" ||
    accessPolicy.blobPublicAccess === "container"
  ) {
    return blobClient.url;
  }

  const credential = getSharedKeyCredential();

  if (!credential) {
    return blobClient.url;
  }

  const sas = generateBlobSASQueryParameters(
    {
      containerName: UPLOADS_CONTAINER_NAME,
      blobName: getBlobName(userId, itemId, filename),
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    },
    credential
  );

  return `${blobClient.url}?${sas.toString()}`;
}
