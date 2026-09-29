import { NextResponse } from 'next/server';

export async function GET() {
  // Generate a quiz question from the knowledge graph
  // Mock response:
  return NextResponse.json({
    entity_id: 'mock-uuid',
    type: 'who_taught',
    question: 'Who taught you maths in 8th grade?',
    correct_answer: 'Mr. Smith'
  });
}

export async function POST(req: Request) {
  try {
    const { entity_id, answer, question_type } = await req.json();
    
    // Compare answer with correct answer
    // Update reviews table (SM-2)
    const isCorrect = answer.toLowerCase().includes('smith');
    
    return NextResponse.json({ 
      correct: isCorrect,
      correctAnswer: 'Mr. Smith',
      nextReview: new Date(Date.now() + 86400000).toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
