import JSZip from 'jszip';
import pako from 'pako';

async function sha1(str: string | Uint8Array): Promise<string> {
  const buffer = typeof str === 'string' ? new TextEncoder().encode(str) : str;
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function compress(data: string | Uint8Array): Uint8Array {
  return pako.deflate(data);
}

async function generateEmptyTree(): Promise<{ hash: string; buffer: Uint8Array }> {
  const content = new Uint8Array(0);
  const header = new TextEncoder().encode(`tree ${content.length}\0`);

  const blob = new Uint8Array(header.length + content.length);
  blob.set(header);
  blob.set(content, header.length);

  const hash = await sha1(blob);
  return { hash, buffer: compress(blob) };
}

async function generateCommit(
  treeHash: string,
  parentHash: string | null,
  authorName: string,
  authorEmail: string,
  timestamp: number,
  message: string
): Promise<{ hash: string; buffer: Uint8Array }> {
  let contentStr = `tree ${treeHash}\n`;
  if (parentHash) {
    contentStr += `parent ${parentHash}\n`;
  }
  contentStr += `author ${authorName} <${authorEmail}> ${timestamp} +0000\n`;
  contentStr += `committer ${authorName} <${authorEmail}> ${timestamp} +0000\n`;
  contentStr += `\n${message}\n`;

  const content = new TextEncoder().encode(contentStr);
  const header = new TextEncoder().encode(`commit ${content.length}\0`);

  const blob = new Uint8Array(header.length + content.length);
  blob.set(header);
  blob.set(content, header.length);

  const hash = await sha1(blob);
  return { hash, buffer: compress(blob) };
}

export async function generateGitRepositoryZip(
  grid: number[][],
  year: number,
  email: string,
  authorName: string,
  maxCommits: number
): Promise<Blob> {
  const zip = new JSZip();
  const repoDir = `github-graph-${year}`;

  // Add a helper README.md to guide the user
  const readmeContent = `# GitHub Contribution Graph - ${year}

This repository contains your custom generated backdated commits to paint your GitHub contribution graph.

## Setup Instructions:

1. **Create a new, empty repository on GitHub**:
   - Go to [github.com/new](https://github.com/new).
   - Name your repository (e.g. \`github-graph-${year}\`).
   - **IMPORTANT**: Do *not* initialize it with a README, .gitignore, or license. Keep it completely blank.

2. **Link and Push**:
   - Open your terminal inside this extracted \`${repoDir}\` folder.
   - Run the following commands (replace \`<your-repo-url>\` with your actual GitHub repository URL):
     \`\`\`bash
     git remote add origin <your-repo-url>
     git branch -M main
     git push -u origin main -f
     \`\`\`

3. **Verify**:
   - Refresh your GitHub profile! Your new contribution graph design should appear shortly.
   - *Note: GitHub can sometimes take up to 5-10 minutes to rebuild your contribution graph index.*
`;

  zip.file(`${repoDir}/README.md`, readmeContent);
  zip.file(`${repoDir}/.git/HEAD`, 'ref: refs/heads/main\n');
  zip.file(
    `${repoDir}/.git/config`,
    '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n'
  );

  const tree = await generateEmptyTree();
  zip.file(`${repoDir}/.git/objects/${tree.hash.substring(0, 2)}/${tree.hash.substring(2)}`, tree.buffer);

  let parentHash: string | null = null;
  const startDay = new Date(year, 0, 1).getDay();

  for (let col = 0; col < 53; col++) {
    for (let row = 0; row < 7; row++) {
      const dayIndex = col * 7 + row - startDay;
      const isLeap = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0);
      const daysInYear = isLeap ? 366 : 365;

      if (dayIndex < 0 || dayIndex >= daysInYear) continue;

      const level = grid[row][col];
      if (level === 0) continue;

      let numCommits = Math.round((level / 4) * maxCommits);
      if (numCommits === 0) numCommits = 1;

      const date = new Date(Date.UTC(year, 0, 1));
      date.setUTCDate(date.getUTCDate() + dayIndex);
      date.setUTCHours(12, 0, 0, 0);

      const timestamp = Math.floor(date.getTime() / 1000);

      for (let i = 0; i < numCommits; i++) {
        const commitTime = timestamp + i;
        const commit = await generateCommit(
          tree.hash,
          parentHash,
          authorName || 'GitGraph User',
          email,
          commitTime,
          `Automated commit ${i + 1} for ${date.toISOString().split('T')[0]}`
        );

        zip.file(
          `${repoDir}/.git/objects/${commit.hash.substring(0, 2)}/${commit.hash.substring(2)}`,
          commit.buffer
        );
        parentHash = commit.hash;
      }
    }
  }

  if (parentHash) {
    zip.file(`${repoDir}/.git/refs/heads/main`, parentHash + '\n');
  }

  return zip.generateAsync({ type: 'blob' });
}
