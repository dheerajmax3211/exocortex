const fs = require('fs');
const file = 'src/app/api/ingest/route.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /- Look at the entity's \\`current_state\\` in the Candidates context. If it has \\`quantity: X\\`, emit a fact updating it to \\`quantity: X\+1\\` \(or \\`quantity: 2\\` if undefined\)\./,
  '- Look at the entity\\'s \\`current_state\\` (which contains its props) in the Candidates context. If it has \\`quantity: X\\`, update the entity\\'s \\`props\\` to include \\`quantity: X+1\\` (or \\`quantity: 2\\` if undefined).'
);

code = code.replace(
  /- If the user says "I now have 3 of these", emit \\`quantity: 3\\`\./,
  '- If the user says "I now have 3 of these", update the entity\\'s \\`props\\` to include \\`quantity: 3\\`.'
);

code = code.replace(
  /- This applies to progression as well \(e\.g\., "finished season 4", emit fact: \\`current_season: 4\\`\)\./,
  '- This applies to progression as well (e.g., "finished season 4", update \\`props\\` with \\`current_season: 4\\`).'
);

fs.writeFileSync(file, code);
