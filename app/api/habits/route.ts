import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { corsHeaders, handleCORS } from '@/lib/cors'

// GET /api/habits - Get all habits for user
export async function GET(request: NextRequest) {
  const auth = getUserFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() })
  }

  try {
    const habits = await prisma.habit.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ habits }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Get habits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() })
  }
}

// POST /api/habits - Create new habit
export async function POST(request: NextRequest) {
  const auth = getUserFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() })
  }

  try {
    const body = await request.json()
    
    const habit = await prisma.habit.create({
      data: {
        userId: auth.userId,
        name: body.name,
        type: body.type || 'good',
        category: body.category,
        difficulty: body.difficulty,
        priority: body.priority || 0,
        identity: body.identity,
        trigger: body.trigger,
        completions: body.completions || [],
        streak: body.streak || 0,
        bestStreak: body.bestStreak || 0,
        costPerDay: body.costPerDay,
        notes: body.notes,
      },
    })

    return NextResponse.json({ habit }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Create habit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() })
  }
}
