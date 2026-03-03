/**
 * LaTeX Compilation API
 *
 * Compiles LaTeX source to PDF using local TeXLive installation.
 * Supports both single-file and multi-file project compilation.
 *
 * POST /api/latex/compile
 * Body (single-file): { content: string, filename?: string }
 * Body (multi-file):  { files: [{path, content}], mainFile?: string }
 * Returns: { success: boolean, pdfUrl?: string, log?: string, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Temp directory for compilation
const TEMP_DIR = path.join(process.cwd(), 'public', 'data', 'latex-temp');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'latex-output');

// Ensure directories exist
async function ensureDirectories() {
  await mkdir(TEMP_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

// Clean old temp files (older than 1 hour)
async function cleanOldFiles() {
  try {
    const { readdir, stat } = await import('fs/promises');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const dir of [TEMP_DIR, OUTPUT_DIR]) {
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const fileStat = await stat(filePath);
        if (now - fileStat.mtimeMs > oneHour) {
          await rm(filePath, { recursive: true, force: true });
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning old files:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename = 'document', files, mainFile, engine = 'pdflatex' } = body;

    // Multi-file project mode
    if (Array.isArray(files) && files.length > 0) {
      return compileProject(files, mainFile, filename, engine);
    }

    // Single-file mode (backward compatible)
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No content provided' },
        { status: 400 }
      );
    }

    return compileSingleFile(content, filename, engine);
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Compile a single LaTeX file (original behavior)
 */
async function compileSingleFile(content: string, filename: string, engine = 'pdflatex') {
  await ensureDirectories();
  cleanOldFiles().catch(console.error);

  const jobId = randomUUID();
  const jobDir = path.join(TEMP_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  const texFile = path.join(jobDir, `${filename}.tex`);
  await writeFile(texFile, content, 'utf-8');

  const engineBin = engine === 'xelatex' ? 'xelatex' : engine === 'lualatex' ? 'lualatex' : 'pdflatex';
  const texBinPath = `/Library/TeX/texbin/${engineBin}`;
  const pdflatexCmd = `${texBinPath} -interaction=nonstopmode -output-directory="${jobDir}" "${texFile}"`;

  let log = '';

  try {
    const { stdout: stdout1, stderr: stderr1 } = await execAsync(pdflatexCmd, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    log += stdout1 + stderr1;

    const { stdout: stdout2, stderr: stderr2 } = await execAsync(pdflatexCmd, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    log += stdout2 + stderr2;
  } catch (execError: unknown) {
    const error = execError as { stdout?: string; stderr?: string };
    log += (error.stdout || '') + (error.stderr || '');

    const pdfPath = path.join(jobDir, `${filename}.pdf`);
    try {
      await readFile(pdfPath);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Compilation failed',
        log: log.slice(-5000),
      });
    }
  }

  const pdfPath = path.join(jobDir, `${filename}.pdf`);
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

  const outputFilename = `${jobId}.pdf`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  await writeFile(outputPath, pdfBuffer);

  await rm(jobDir, { recursive: true, force: true });

  const pdfUrl = `/data/latex-output/${outputFilename}`;

  return NextResponse.json({
    success: true,
    pdfUrl,
    pdfDataUrl,
    log: log.slice(-2000),
  });
}

/**
 * Compile a multi-file LaTeX project
 * Writes all files to a temp directory preserving paths, then runs pdflatex.
 */
async function compileProject(
  files: Array<{ path: string; content: string }>,
  mainFile?: string,
  fallbackFilename?: string,
  engine = 'pdflatex'
) {
  await ensureDirectories();
  cleanOldFiles().catch(console.error);

  const jobId = randomUUID();
  const jobDir = path.join(TEMP_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  // Write all project files preserving directory structure
  for (const file of files) {
    const filePath = path.join(jobDir, file.path);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
  }

  // Determine main file
  const main = mainFile || files.find(f => f.path.endsWith('.tex'))?.path || `${fallbackFilename || 'document'}.tex`;
  const mainBasename = path.basename(main, '.tex');

  const engineBin = engine === 'xelatex' ? 'xelatex' : engine === 'lualatex' ? 'lualatex' : 'pdflatex';
  const texBinPath = `/Library/TeX/texbin/${engineBin}`;
  const texFilePath = path.join(jobDir, main);
  const pdflatexCmd = `${texBinPath} -interaction=nonstopmode -output-directory="${jobDir}" "${texFilePath}"`;

  let log = '';

  try {
    // First pass
    const { stdout: s1, stderr: e1 } = await execAsync(pdflatexCmd, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: jobDir,
    });
    log += s1 + e1;

    // Second pass for references
    const { stdout: s2, stderr: e2 } = await execAsync(pdflatexCmd, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: jobDir,
    });
    log += s2 + e2;
  } catch (execError: unknown) {
    const error = execError as { stdout?: string; stderr?: string };
    log += (error.stdout || '') + (error.stderr || '');

    const pdfPath = path.join(jobDir, `${mainBasename}.pdf`);
    try {
      await readFile(pdfPath);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Compilation failed',
        log: log.slice(-5000),
      });
    }
  }

  const pdfPath = path.join(jobDir, `${mainBasename}.pdf`);
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

  const outputFilename = `${jobId}.pdf`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  await writeFile(outputPath, pdfBuffer);

  await rm(jobDir, { recursive: true, force: true });

  const pdfUrl = `/data/latex-output/${outputFilename}`;

  return NextResponse.json({
    success: true,
    pdfUrl,
    pdfDataUrl,
    log: log.slice(-2000),
  });
}

// GET endpoint to check if TeXLive is available
export async function GET() {
  try {
    const { stdout } = await execAsync('/Library/TeX/texbin/pdflatex --version');
    const version = stdout.split('\n')[0];
    
    return NextResponse.json({
      available: true,
      version,
    });
  } catch {
    return NextResponse.json({
      available: false,
      error: 'TeXLive not found',
    });
  }
}
