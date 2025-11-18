import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/habits - Get all habits for user
export async function GET(request: NextRequest) {
  const auth = getUserFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const habits = await prisma.habit.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ habits })
  } catch (error) {
    console.error('Get habits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/habits - Create new habit
export async function POST(request: NextRequest) {
  const auth = getUserFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({ habit })
  } catch (error) {
    console.error('Create habit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
