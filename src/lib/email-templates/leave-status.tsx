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
  leaveType?: string
  period?: string
  status?: string
  note?: string | null
}

const Email = ({ recipientName, leaveType, period, status, note }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>{`تحديث على طلب الإجازة: ${leaveType ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>مؤسسة اليتيم التنموية</Text>
        <Heading style={heading}>تحديث على طلب إجازة</Heading>
        <Text style={text}>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</Text>
        <Section style={card}>
          <Text style={titleStyle}>{leaveType ?? '—'}</Text>
          <Text style={meta}>الفترة: {period ?? '—'}</Text>
          <Text style={meta}>الحالة: {status ?? '—'}</Text>
          {note ? <Text style={meta}>ملاحظة: {note}</Text> : null}
        </Section>
        <Text style={footer}>يمكنك متابعة تفاصيل الطلب من صفحة الإجازات في النظام.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `تحديث على طلب الإجازة: ${data['leaveType'] ?? ''}`,
  displayName: 'تحديث طلب إجازة',
  previewData: {
    recipientName: 'سارة محمد',
    leaveType: 'إجازة سنوية',
    period: '2026-08-10 إلى 2026-08-14',
    status: 'معتمدة نهائياً',
    note: null,
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
const titleStyle = { fontSize: '16px', fontWeight: 700, color: '#16345E', margin: '0 0 8px' }
const meta = { fontSize: '13px', color: '#45566B', margin: '0 0 4px' }
const footer = { fontSize: '12px', color: '#64748B', marginTop: '16px' }
