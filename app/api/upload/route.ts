import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables.' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `scorecards/${fileName}` // Store in scorecards folder within bucket

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin.storage
      .from('scorecards')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return NextResponse.json({ error: `Failed to upload file: ${error.message}` }, { status: 500 })
    }

    if (!data) {
      console.error('No data returned from Supabase upload')
      return NextResponse.json({ error: 'Upload succeeded but no data returned' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('scorecards')
      .getPublicUrl(filePath)

    console.log('File uploaded successfully:', filePath)
    console.log('Public URL:', urlData.publicUrl)

    if (!urlData || !urlData.publicUrl) {
      console.error('No public URL returned')
      return NextResponse.json({ error: 'Failed to get public URL' }, { status: 500 })
    }

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    const errorMessage = error?.message || 'Failed to upload file'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

