import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  taskTitle?: string
  status?: string
  progress?: number
  updatedBy?: string
}

const Email = ({ recipientName, taskTitle, status, progress, updatedBy }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>{`تحديث حالة المهمة: ${taskTitle ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>مؤسسة اليتيم التنموية</Text>
        <Heading style={heading}>تحديث على حالة مهمة</Heading>
        <Text style={text}>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</Text>
        <Section style={card}>
          <Text style={taskTitleStyle}>{taskTitle ?? '—'}</Text>
          <Text style={meta}>الحالة الجديدة: {status ?? '—'}</Text>
          <Text style={meta}>نسبة الإنجاز: {typeof progress === 'number' ? `${progress}%` : '—'}</Text>
          <Text style={meta}>بواسطة: {updatedBy ?? '—'}</Text>
        </Section>
        <Text style={footer}>لمزيد من التفاصيل، افتح المهمة في نظام الموارد البشرية.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `تحديث حالة المهمة: ${data['taskTitle'] ?? ''}`,
  displayName: 'تغيير حالة مهمة',
  previewData: {
    recipientName: 'سارة محمد',
    taskTitle: 'إعداد تقرير الأداء الشهري',
    status: 'منجزة',
    progress: 100,
    updatedBy: 'أحمد سالم',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brand = { color: '#1B4B8C', fontSize: '13px', fontWeight: 700, margin: '0 0 4px' }
const heading = { fontSize: '20px', color: '#16345E', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '22px', margin: '0 0 8px' }
const card = {
  backgroundColor: '#F2F6FB',
  borderRight: '4px solid #7CB342',
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '16px 0',
}
const taskTitleStyle = { fontSize: '16px', fontWeight: 700, color: '#16345E', margin: '0 0 8px' }
const meta = { fontSize: '13px', color: '#45566B', margin: '0 0 4px' }
const footer = { fontSize: '12px', color: '#64748B', marginTop: '16px' }
