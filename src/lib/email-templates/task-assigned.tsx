import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  employeeName?: string
  taskTitle?: string
  taskDescription?: string
  priority?: string
  dueDate?: string
  assignedBy?: string
}

const Email = ({
  employeeName,
  taskTitle,
  taskDescription,
  priority,
  dueDate,
  assignedBy,
}: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>{`مهمة جديدة: ${taskTitle ?? 'تكليف جديد'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>مؤسسة اليتيم التنموية</Text>
        <Heading style={heading}>تم تكليفك بمهمة جديدة</Heading>
        <Text style={text}>{employeeName ? `مرحباً ${employeeName}،` : 'مرحباً،'}</Text>
        <Section style={card}>
          <Text style={taskTitleStyle}>{taskTitle ?? '—'}</Text>
          {taskDescription && <Text style={text}>{taskDescription}</Text>}
          <Hr style={hr} />
          <Text style={meta}>الأولوية: {priority ?? 'متوسطة'}</Text>
          <Text style={meta}>تاريخ الاستحقاق: {dueDate ?? 'غير محدد'}</Text>
          <Text style={meta}>المكلِّف: {assignedBy ?? 'الإدارة'}</Text>
        </Section>
        <Text style={footer}>
          يمكنك متابعة المهمة وتحديث نسبة الإنجاز من نظام الموارد البشرية.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `مهمة جديدة: ${data['taskTitle'] ?? 'تكليف جديد'}`,
  displayName: 'تكليف بمهمة جديدة',
  previewData: {
    employeeName: 'أحمد سالم',
    taskTitle: 'إعداد تقرير الأداء الشهري',
    taskDescription: 'تجميع مؤشرات الإنجاز للقسم ورفعها للإدارة.',
    priority: 'عالية',
    dueDate: '2026-08-15',
    assignedBy: 'المدير التنفيذي',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brand = { color: '#1B4B8C', fontSize: '13px', fontWeight: 700, margin: '0 0 4px' }
const heading = { fontSize: '20px', color: '#16345E', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '22px', margin: '0 0 8px' }
const card = {
  backgroundColor: '#F2F6FB',
  borderRight: '4px solid #1B4B8C',
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '16px 0',
}
const taskTitleStyle = { fontSize: '16px', fontWeight: 700, color: '#16345E', margin: '0 0 8px' }
const meta = { fontSize: '13px', color: '#45566B', margin: '0 0 4px' }
const hr = { borderColor: '#D8E2EE', margin: '12px 0' }
const footer = { fontSize: '12px', color: '#64748B', marginTop: '16px' }
