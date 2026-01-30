import { Sandbox } from '@e2b/code-interpreter';
import { RepoFingerprint, TestResult } from '../types';
import { logger } from '../utils/logger';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

export class E2BSandbox {
  private sandbox: Sandbox | null = null;

  /**
   * Provisions a new E2B sandbox environment for the given repository.
   */
  async provision(githubUrl: string, fingerprint: RepoFingerprint, localPath?: string): Promise<void> {
    logger.info('Creating E2B sandbox...');

    let template = fingerprint.runtime;
    if (template === 'base' || template === 'ubuntu' || template === 'default') {
      template = undefined as any;
    }

    try {
      this.sandbox = await Sandbox.create(template, {
        timeoutMs: 900000 // 15 minutes
      });
    } catch (e: any) {
      logger.warn(`Failed to create sandbox with template ${template}: ${e.message}. Falling back to default.`);
      this.sandbox = await Sandbox.create(undefined as any, {
        timeoutMs: 900000
      });
    }

    if (!this.sandbox) {
      throw new Error('Failed to initialize sandbox instance.');
    }

    logger.info('Sandbox instance created.');

    const repoDir = 'repo';
    const absRepoPath = '/home/user/repo';

    if (localPath) {
      logger.info(`Syncing local repository: ${localPath}`);
      await this.syncLocalRepo(localPath, repoDir);
    } else {
      try {
        const clone = await this.sandbox.commands.run(`git clone ${githubUrl} ${repoDir}`);
        if (clone.exitCode !== 0) {
          throw new Error(`Git clone failed with exit code ${clone.exitCode}: ${clone.stderr}`);
        }
      } catch (e: any) {
        logger.error(`Git clone failed: ${e.message}`);
        throw e;
      }
    }

    // Stack specific setup
    await this.ensureRuntimeDependencies(fingerprint);

    // Install project dependencies
    const installCmd = `cd ${absRepoPath} && ${fingerprint.installCommand}`;
    try {
      const install = await this.sandbox.commands.run(installCmd);
      if (install.exitCode !== 0) {
        logger.warn(`Warning: Installation command failed: ${install.stderr}`);
      }
    } catch (e: any) {
      logger.error(`Error during dependency installation: ${e.message}`);
    }

    logger.success('Sandbox environment is ready');
  }

  /**
   * Ensures that basic runtime dependencies are present in the sandbox.
   */
  private async ensureRuntimeDependencies(fingerprint: RepoFingerprint): Promise<void> {
    if (!this.sandbox) return;

    if (fingerprint.language.toLowerCase() === 'go') {
      try {
        await this.sandbox.commands.run('go version');
      } catch {
        logger.info('Installing Go runtime...');
        await this.sandbox.commands.run('sudo apt-get update && sudo apt-get install -y golang');
      }
    }
    // Add other language-specific checks as needed
  }

  /**
   * Syncs a local repository to the sandbox using git archive.
   */
  private async syncLocalRepo(localPath: string, remotePath: string): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized');

    const tempTarPath = path.join(os.tmpdir(), `oss-dev-sync-${Date.now()}.tar`);
    
    try {
      // Create a tar archive of the current local state
      execSync(`git archive --format=tar -o "${tempTarPath}" HEAD`, { cwd: localPath });
      const tarContent = await fs.readFile(tempTarPath);

      await this.sandbox.commands.run(`mkdir -p ${remotePath}`);
      const remoteTarPath = '/tmp/repo.tar';

      // Upload the tar file to the sandbox
      try {
        await this.sandbox.files.write(remoteTarPath, tarContent as any);
      } catch {
        // Fallback for environments where Buffer might not be handled directly
        await this.sandbox.files.write(remoteTarPath, tarContent.toString('base64'));
        await this.sandbox.commands.run(`base64 -d ${remoteTarPath} > ${remoteTarPath}.tmp && mv ${remoteTarPath}.tmp ${remoteTarPath}`);
      }

      // Extract the archive in the sandbox
      const extract = await this.sandbox.commands.run(`tar -xf ${remoteTarPath} -C ${remotePath}`);
      if (extract.exitCode !== 0) {
        throw new Error(`Failed to extract repository archive: ${extract.stderr}`);
      }
    } catch (error: any) {
      logger.error(`Local sync failed: ${error.message}`);
      throw error;
    } finally {
      // Clean up local temp file
      try {
        await fs.unlink(tempTarPath);
      } catch {
        // Ignore unlink errors
      }
    }
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.sandbox) throw new Error('Sandbox not initialized');
    return await this.sandbox.files.read(filePath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized');
    await this.sandbox.files.write(filePath, content);
  }

  async runTests(testCommand: string): Promise<TestResult> {
    if (!this.sandbox) throw new Error('Sandbox not initialized');

    const start = Date.now();
    const result = await this.sandbox.commands.run(testCommand);

    return {
      passed: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      duration: Date.now() - start,
    };
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.kill();
      this.sandbox = null;
    }
  }
}

