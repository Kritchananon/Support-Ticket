// src/app/shared/models/notification.model.ts

/**
 * ✅ Notification Model
 * สำหรับจัดการข้อมูล notification ในระบบ
 */

// ===== ENUMS ===== ✅

/**
 * ประเภทของ notification ตาม backend
 */
export enum NotificationType {
  NEW_TICKET = 'NEW_TICKET',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  COMMENT = 'COMMENT',
  MENTION = 'MENTION',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

/**
 * สถานะของ notification
 */
export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived'
}

/**
 * ระดับความสำคัญของ notification
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// ===== INTERFACES ===== ✅

/**
 * Payload สำหรับส่งไปยัง backend API
 */
export interface NotificationPayload {
  ticket_no: string;
  statusId?: number;
  assignedUserId?: number;
  isNewTicket?: boolean;
}

/**
 * ข้อมูล notification ที่ได้จาก backend
 */
export interface AppNotification {
  id: number;
  ticket_no: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  created_at: string;
  read_at?: string;
  user_id: number;
  related_user_id?: number;
  metadata?: NotificationMetadata;
}

/**
 * ข้อมูลเพิ่มเติมของ notification
 */
export interface NotificationMetadata {
  ticket_id?: number;
  old_status?: number;
  new_status?: number;
  assigned_by?: number;
  assigned_to?: number;
  comment_id?: number;
  mentioned_by?: number;
  [key: string]: any;
}

/**
 * Response จาก backend API /api/notify-changes
 */
export interface NotificationResponse {
  success: boolean;
  message: string;
  data: AppNotification[];
  summary: {
    total_notifications: number;
    new_ticket: number;
    status_change: number;
    assignment: number;
  };
}

/**
 * ข้อมูลสรุปการแจ้งเตือน
 */
export interface NotificationSummary {
  total: number;
  unread: number;
  today: number;
  high_priority: number;
  by_type: {
    [key in NotificationType]?: number;
  };
}

/**
 * ตัวเลือกสำหรับดึงรายการ notification
 */
export interface NotificationQueryOptions {
  status?: NotificationStatus;
  type?: NotificationType;
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
  priority?: NotificationPriority;
}

/**
 * ตัวเลือกสำหรับ notification settings
 */
export interface NotificationSettings {
  email_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  types: {
    [key in NotificationType]: boolean;
  };
  priority_filter: NotificationPriority[];
}

/**
 * Display notification สำหรับแสดงใน UI
 */
export interface DisplayNotification extends AppNotification {
  timeAgo: string;
  icon: string;
  color: string;
  route?: string;
}

// ===== HELPER FUNCTIONS ===== ✅

/**
 * แปลง NotificationType เป็นข้อความแสดง
 */
export function getNotificationTypeLabel(type: NotificationType, language: 'th' | 'en' = 'th'): string {
  const labels: { [key in NotificationType]: { th: string; en: string } } = {
    [NotificationType.NEW_TICKET]: { th: 'Ticket ใหม่', en: 'New Ticket' },
    [NotificationType.STATUS_CHANGE]: { th: 'เปลี่ยนสถานะ', en: 'Status Changed' },
    [NotificationType.ASSIGNMENT]: { th: 'มอบหมายงาน', en: 'Assignment' },
    [NotificationType.COMMENT]: { th: 'ความคิดเห็น', en: 'Comment' },
    [NotificationType.MENTION]: { th: 'แท็กคุณ', en: 'Mentioned' },
    [NotificationType.RESOLVED]: { th: 'แก้ไขแล้ว', en: 'Resolved' },
    [NotificationType.CLOSED]: { th: 'ปิดแล้ว', en: 'Closed' }
  };

  return labels[type][language];
}

/**
 * แปลง NotificationPriority เป็นข้อความแสดง
 */
export function getNotificationPriorityLabel(priority: NotificationPriority, language: 'th' | 'en' = 'th'): string {
  const labels: { [key in NotificationPriority]: { th: string; en: string } } = {
    [NotificationPriority.LOW]: { th: 'ต่ำ', en: 'Low' },
    [NotificationPriority.MEDIUM]: { th: 'ปานกลาง', en: 'Medium' },
    [NotificationPriority.HIGH]: { th: 'สูง', en: 'High' },
    [NotificationPriority.URGENT]: { th: 'เร่งด่วน', en: 'Urgent' }
  };

  return labels[priority][language];
}

/**
 * ได้รับสีตาม NotificationType
 */
export function getNotificationTypeColor(type: NotificationType): string {
  const colors: { [key in NotificationType]: string } = {
    [NotificationType.NEW_TICKET]: '#6c5ce7',    // สีม่วง
    [NotificationType.STATUS_CHANGE]: '#74b9ff', // สีฟ้า
    [NotificationType.ASSIGNMENT]: '#fdcb6e',    // สีเหลือง
    [NotificationType.COMMENT]: '#00b894',       // สีเขียว
    [NotificationType.MENTION]: '#e17055',       // สีส้ม
    [NotificationType.RESOLVED]: '#00b894',      // สีเขียว
    [NotificationType.CLOSED]: '#636e72'         // สีเทา
  };

  return colors[type];
}

/**
 * ได้รับ icon class ตาม NotificationType
 */
export function getNotificationTypeIcon(type: NotificationType): string {
  const icons: { [key in NotificationType]: string } = {
    [NotificationType.NEW_TICKET]: 'bi-plus-circle-fill',
    [NotificationType.STATUS_CHANGE]: 'bi-arrow-repeat',
    [NotificationType.ASSIGNMENT]: 'bi-person-check-fill',
    [NotificationType.COMMENT]: 'bi-chat-dots-fill',
    [NotificationType.MENTION]: 'bi-at',
    [NotificationType.RESOLVED]: 'bi-check-circle-fill',
    [NotificationType.CLOSED]: 'bi-x-circle-fill'
  };

  return icons[type];
}

/**
 * ได้รับสีตาม NotificationPriority
 */
export function getNotificationPriorityColor(priority: NotificationPriority): string {
  const colors: { [key in NotificationPriority]: string } = {
    [NotificationPriority.LOW]: '#00b894',       // สีเขียว
    [NotificationPriority.MEDIUM]: '#74b9ff',    // สีฟ้า
    [NotificationPriority.HIGH]: '#fdcb6e',      // สีเหลือง
    [NotificationPriority.URGENT]: '#e17055'     // สีแดง
  };

  return colors[priority];
}

/**
 * ตรวจสอบว่า notification เป็นแบบเร่งด่วนหรือไม่
 */
export function isUrgentNotification(notification: AppNotification): boolean {
  return notification.priority === NotificationPriority.URGENT;
}

/**
 * ตรวจสอบว่า notification ยังไม่ได้อ่านหรือไม่
 */
export function isUnreadNotification(notification: AppNotification): boolean {
  return notification.status === NotificationStatus.UNREAD;
}

/**
 * สร้าง DisplayNotification จาก Notification
 */
export function createDisplayNotification(notification: AppNotification): DisplayNotification {
  return {
    ...notification,
    timeAgo: formatTimeAgo(notification.created_at),
    icon: getNotificationTypeIcon(notification.notification_type),
    color: getNotificationTypeColor(notification.notification_type),
    route: `/tickets/${notification.ticket_no}`
  };
}

/**
 * แปลงเวลาเป็นรูปแบบ "time ago"
 */
export function formatTimeAgo(dateString: string, language: 'th' | 'en' = 'th'): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  const labels = {
    th: {
      year: ['ปีที่แล้ว', 'ปีที่แล้ว'],
      month: ['เดือนที่แล้ว', 'เดือนที่แล้ว'],
      week: ['สัปดาห์ที่แล้ว', 'สัปดาห์ที่แล้ว'],
      day: ['วันที่แล้ว', 'วันที่แล้ว'],
      hour: ['ชั่วโมงที่แล้ว', 'ชั่วโมงที่แล้ว'],
      minute: ['นาทีที่แล้ว', 'นาทีที่แล้ว'],
      just_now: 'เมื่อสักครู่'
    },
    en: {
      year: ['year ago', 'years ago'],
      month: ['month ago', 'months ago'],
      week: ['week ago', 'weeks ago'],
      day: ['day ago', 'days ago'],
      hour: ['hour ago', 'hours ago'],
      minute: ['minute ago', 'minutes ago'],
      just_now: 'Just now'
    }
  };

  if (seconds < 60) {
    return labels[language].just_now;
  }

  for (const [key, value] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / value);
    if (interval >= 1) {
      const label = labels[language][key as keyof typeof labels['th']];
      if (Array.isArray(label)) {
        return `${interval} ${label[interval === 1 ? 0 : 1]}`;
      }
      return label;
    }
  }

  return labels[language].just_now;
}

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_enabled: true,
  push_enabled: true,
  sound_enabled: true,
  types: {
    [NotificationType.NEW_TICKET]: true,
    [NotificationType.STATUS_CHANGE]: true,
    [NotificationType.ASSIGNMENT]: true,
    [NotificationType.COMMENT]: true,
    [NotificationType.MENTION]: true,
    [NotificationType.RESOLVED]: true,
    [NotificationType.CLOSED]: true
  },
  priority_filter: [
    NotificationPriority.LOW,
    NotificationPriority.MEDIUM,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT
  ]
};