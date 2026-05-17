const fs = require('fs');
const filePath = 'C:\\vs\\KELVISI\\views\\ClientBooking.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Replace lines 182-203 (1-indexed) = indices 181-202 (0-indexed)
const newBlock = [
  '    if (approvedReviews.length === 0) return null;',
  '',
  '    return (',
  '      <div className="w-full overflow-hidden bg-zinc-900 py-8 border-y border-zinc-800">',
  '        {/*',
  '          The wrapper holds two identical tracks (A and B).',
  '          Each track repeats reviews enough times to exceed viewport width.',
  '          Animation: 0 to -50% (one track width). At reset the view is identical,',
  '          so the loop is perfectly seamless with no empty gaps at the end.',
  '        */}',
  '        <div className="animate-marquee">',
  '          {/* Track A */}',
  '          <div className="flex gap-6 pr-6">',
  '            {track.map((r, i) => <ReviewCard key={`a-${i}`} review={r} idx={i} />)}',
  '          </div>',
  '          {/* Track B - aria-hidden duplicate, keeps the loop seamless */}',
  '          <div className="flex gap-6 pr-6" aria-hidden="true">',
  '            {track.map((r, i) => <ReviewCard key={`b-${i}`} review={r} idx={i} />)}',
  '          </div>',
  '        </div>',
  '      </div>',
  '    );',
  '  };',
];

const before = lines.slice(0, 181);
const after = lines.slice(203);
const result = [...before, ...newBlock, ...after].join('\n');
fs.writeFileSync(filePath, result, 'utf8');
console.log('Done.');
