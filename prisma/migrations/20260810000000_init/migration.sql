-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "rtmpUrl" TEXT NOT NULL,
    "hlsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stream_streamKey_key" ON "Stream"("streamKey");
