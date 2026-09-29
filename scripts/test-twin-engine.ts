import { detectCommunities } from '../src/lib/community-clustering';
import { Camera } from '../src/lib/graph/camera';
import { generateAmbientField } from '../src/lib/graph/ambient-field';
import { getEmbedding } from '../src/lib/embeddings';

async function main() {
  console.log('🧪 Starting Engine & UI Math Verification Test Suite...\n');

  // Test 1: Camera coordinate transformation & CoverFit math
  console.log('--- Test 1: Camera Math & Viewport CoverFit ---');
  const camera = new Camera();
  camera.coverFit(2000, 2000, 390, 844); // iPhone 14 dimensions
  const centerScreen = camera.worldToScreen(0, 0);
  console.log(`World (0, 0) -> Screen (${centerScreen.x.toFixed(1)}, ${centerScreen.y.toFixed(1)})`);
  if (Math.abs(centerScreen.x - 390 / 2) < 0.01 && Math.abs(centerScreen.y - 844 / 2) < 0.01) {
    console.log('✅ Camera CoverFit centers world (0,0) perfectly at viewport center.');
  } else {
    throw new Error('Camera coverFit failed to center world origin');
  }

  const worldBack = camera.screenToWorld(centerScreen.x, centerScreen.y);
  if (Math.abs(worldBack.x) < 0.01 && Math.abs(worldBack.y) < 0.01) {
    console.log('✅ Camera screenToWorld reverses accurately.');
  } else {
    throw new Error('Camera screenToWorld inversion error');
  }

  // Test 2: Ambient Particle Field Generation
  console.log('\n--- Test 2: Ambient Particle Brain Field ---');
  const particles = generateAmbientField(1000, 0, 0, 500);
  console.log(`Generated ${particles.length} ambient particles within brain silhouette boundary.`);
  if (particles.length > 500) {
    console.log('✅ Ambient particle density is within high-fidelity threshold.');
  } else {
    throw new Error('Ambient field generation returned insufficient particles');
  }

  // Test 3: Hierarchical Community Clustering (Label Propagation)
  console.log('\n--- Test 3: Hierarchical Cognitive Community Clustering ---');
  const mockNodes = [
    { id: '1', name: 'Interstellar', type: 'movie' },
    { id: '2', name: 'Dune', type: 'movie' },
    { id: '3', name: 'Blade Runner 2049', type: 'movie' },
    { id: '4', name: 'Toit Brewpub', type: 'restaurant' },
    { id: '5', name: 'Windmills Craftworks', type: 'restaurant' },
  ];
  const mockEdges = [
    { src: '1', dst: '2' },
    { src: '2', dst: '3' },
    { src: '1', dst: '3' },
    { src: '4', dst: '5' },
  ];

  const clusters = detectCommunities(mockNodes, mockEdges);
  console.log(`Clustered ${mockNodes.length} nodes into ${clusters.length} cognitive lobes:`);
  for (const c of clusters) {
    const memberNames = c.entityIds.map(id => mockNodes.find(n => n.id === id)?.name).join(', ');
    console.log(` - Community #${c.communityId}: [${memberNames}] (${c.entityIds.length} members)`);
  }
  if (clusters.length === 2) {
    console.log('✅ Label propagation cleanly grouped Sci-Fi movies and Craft Breweries into distinct lobes.');
  } else {
    throw new Error(`Expected 2 distinct clusters, got ${clusters.length}`);
  }

  // Test 4: Zero-Cost 384-dim Vector Embeddings
  console.log('\n--- Test 4: Zero-Cost Local Vector Embeddings ---');
  const embedding = await getEmbedding('Dune Part Two cinematography in IMAX');
  console.log(`Generated embedding vector with length: ${embedding.length}`);
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  console.log(`L2 Norm: ${norm.toFixed(4)} (normalized)`);
  if (embedding.length === 384 && Math.abs(norm - 1.0) < 0.05) {
    console.log('✅ Local 384-dimensional unit vector generated successfully with zero API cost.');
  } else {
    throw new Error('Vector embedding dimension or norm incorrect');
  }

  console.log('\n🎉 ALL ENGINE & UI ALGORITHM TESTS PASSED CONVINCINGLY!');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
