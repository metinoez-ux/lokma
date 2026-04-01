'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateFilter } from './useOrders';

export interface FeedbackRatings {
  productPortfolio?: number;
  appUsability?: number;
  deliverySpeed?: number;
  overallExperience?: number;
  foodFreshness?: number;
  courierProfessionalism?: number;
}

export interface Feedback {
  id: string;
  userId: string;
  businessId: string;
  ratings: FeedbackRatings;
  averageRating: number;
  note?: string;
  createdAt: any;
  month: string;
  isAnonymous: boolean;
  wasDeliveryOrder: boolean;
  // Raw document data
  _raw: any;
}

function mapDocToFeedback(docId: string, d: any): Feedback {
  return {
    id: docId,
    userId: d.userId || '',
    businessId: d.businessId || d.butcherId || '',
    ratings: {
      productPortfolio: d.ratings?.productPortfolio,
      appUsability: d.ratings?.appUsability,
      deliverySpeed: d.ratings?.deliverySpeed,
      overallExperience: d.ratings?.overallExperience,
      foodFreshness: d.ratings?.foodFreshness,
      courierProfessionalism: d.ratings?.courierProfessionalism,
    },
    averageRating: d.averageRating || 0,
    note: d.note,
    createdAt: d.createdAt,
    month: d.month || '',
    isAnonymous: !!d.isAnonymous,
    wasDeliveryOrder: !!d.wasDeliveryOrder,
    _raw: d,
  };
}

function getStartDateForFilter(filter: DateFilter): Date {
  if (filter === 'all') return new Date(2020, 0, 1);
  
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  
  if (filter === 'week') date.setDate(date.getDate() - 7);
  else if (filter === 'month') date.setDate(date.getDate() - 30);
  // 'today' = start of today, already set
  
  return date;
}

export interface UseFeedbacksOptions {
  businessId?: string | null;
  initialDateFilter?: DateFilter;
}

export function useFeedbacks(options: UseFeedbacksOptions = {}) {
  const { businessId, initialDateFilter = 'all' } = options;
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);

  useEffect(() => {
    setLoading(true);
    const startDate = getStartDateForFilter(dateFilter);
    
    const constraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    ];
    
    if (businessId) {
      constraints.unshift(where('businessId', '==', businessId));
    }
    
    const qFeedbacks = query(collection(db, 'feedback'), ...constraints);

    const unsub = onSnapshot(qFeedbacks, (snapshot) => {
      let mapped = snapshot.docs.map(doc => mapDocToFeedback(doc.id, doc.data()));
      if (businessId) {
        mapped = mapped.filter(o => o.businessId === businessId);
      }
      setFeedbacks(mapped);
      setLoading(false);
    }, (error) => {
      console.warn('[useFeedbacks] Warning loading feedbacks:', error.message);
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [dateFilter, businessId]);

  return {
    feedbacks,
    loading,
    dateFilter,
    setDateFilter,
  };
}
