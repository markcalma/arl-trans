import { Client } from 'ssh2'
import fs from 'fs'
import { spawnSync } from 'child_process'

// Step 1: Create fresh tar from current .next/ build
// Use local relative path — avoids Windows drive-letter issue with tar.exe
const tmpTar = 'nextjs-min.tar.gz'
console.log('Creating tar from .next/ build...')
const tar = spawnSync('tar', [
  '-czf', tmpTar,
  '--exclude=.next/cache',
  '--exclude=.next/dev',
  '--exclude=.next/diagnostics',
  '--exclude=.next/trace',
  '--exclude=.next/trace-build',
  '.next'
], { stdio: 'inherit', shell: false })

if (tar.status !== 0) {
  console.error('tar failed')
  process.exit(1)
}

const stat = fs.statSync(tmpTar)
console.log(`Tar created: ${(stat.size / 1024 / 1024).toFixed(1)}MB`)

// Step 2: Upload to VPS and restart
const conn = new Client()

conn.on('ready', () => {
  console.log('Connected. Starting SFTP upload...')
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return }

    const localFile = tmpTar
    const remoteFile = '/tmp/nextjs-min.tar.gz'

    const readStream = fs.createReadStream(localFile)
    const writeStream = sftp.createWriteStream(remoteFile)

    writeStream.on('close', () => {
      console.log('\nUpload done. Extracting...')
      conn.exec(
        'cd /opt/arl-trans/dashboard && rm -rf .next && tar -xzf /tmp/nextjs-min.tar.gz && ls .next/ && pm2 restart arl-dashboard && sleep 2 && pm2 list | grep arl-dashboard',
        (err, stream) => {
          if (err) { console.error(err); conn.end(); return }
          stream.on('data', d => process.stdout.write(d))
          stream.stderr.on('data', d => process.stderr.write(d))
          stream.on('close', () => { console.log('Done!'); conn.end() })
        }
      )
    })

    writeStream.on('error', e => { console.error('Write error:', e); conn.end() })
    readStream.pipe(writeStream)

    let uploaded = 0
    readStream.on('data', chunk => {
      uploaded += chunk.length
      process.stdout.write(`\rUploading... ${(uploaded/1024/1024).toFixed(1)}MB`)
    })
  })
}).on('error', e => console.error('SSH error:', e))
 .connect({ host: '72.62.199.171', port: 22, username: 'root', password: 'Bugoykini.72893' })
