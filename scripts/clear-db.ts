import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function clearDatabase() {
  console.log('🧹 Clearing Virtual Brain memory database...');

  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users.users[0]?.id;
  if (!userId) {
    console.error('No user found');
    return;
  }
  console.log(`User: ${userId} (${users.users[0]?.email})`);

  // 1. Delete junction and leaf tables first
  console.log('1. Deleting entry_entities...');
  await supabase.from('entry_entities').delete().neq('entry_id', '00000000-0000-0000-0000-000000000000');

  console.log('2. Deleting facts...');
  await supabase.from('facts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('3. Deleting edges...');
  await supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('4. Deleting entries...');
  await supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('5. Deleting clusters...');
  await supabase.from('clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('6. Deleting reviews...');
  await supabase.from('reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('7. Deleting graph_layout...');
  await supabase.from('graph_layout').delete().neq('entity_id', '00000000-0000-0000-0000-000000000000');

  // 8. Delete all entities except the root user entity
  console.log('8. Cleaning entities...');
  // Find root user entity
  const { data: meEntity } = await supabase
    .from('entities')
    .select('id')
    .eq('user_id', userId)
    .eq('props->>is_user', 'true')
    .maybeSingle();

  if (meEntity) {
    // Delete all other entities
    await supabase.from('entities').delete().neq('id', meEntity.id);
    // Reset root user entity to pristine state
    await supabase.from('entities').update({
      name: 'Dheeraj Srinivasa',
      aliases: ['Dheeraj', 'Dheeraj Srinivasa', 'me', 'i', 'myself'],
      summary: 'Root user of this brain',
      props: { is_user: true }
    }).eq('id', meEntity.id);

    // Re-insert root node into graph_layout at (0, 0)
    await supabase.from('graph_layout').insert({
      entity_id: meEntity.id,
      user_id: userId,
      x: 0,
      y: 0
    });
  } else {
    // If no root entity, wipe all and recreate clean root
    await supabase.from('entities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { data: newMe } = await supabase.from('entities').insert({
      user_id: userId,
      name: 'Dheeraj Srinivasa',
      type: 'person',
      aliases: ['Dheeraj', 'Dheeraj Srinivasa', 'me', 'i', 'myself'],
      summary: 'Root user of this brain',
      props: { is_user: true }
    }).select('id').single();

    if (newMe) {
      await supabase.from('graph_layout').insert({
        entity_id: newMe.id,
        user_id: userId,
        x: 0,
        y: 0
      });
    }
  }

  console.log('✅ Database successfully cleared! Ready for fresh data.');
}

clearDatabase().catch(err => {
  console.error('Error clearing database:', err);
  process.exit(1);
});
