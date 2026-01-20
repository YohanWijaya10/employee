"use client";

import { useState, useEffect } from 'react';
/* eslint-disable @next/next/no-img-element */

interface VisitPhotoPreviewProps {
  visitId: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  showModal?: boolean;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-24 h-24',
  lg: 'w-48 h-48',
  full: 'w-full max-w-md',
};

export function VisitPhotoPreview({
  visitId,
  size = 'md',
  className = '',
  showModal = true,
}: VisitPhotoPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch signed URL when component mounts or becomes visible
  useEffect(() => {
    let isMounted = true;

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/visits/${visitId}/photo-url`, {
          headers: {
            'X-API-KEY': process.env.NEXT_PUBLIC_API_KEY || '',
          },
        });

        if (!isMounted) return;

        if (!response.ok) {
          if (response.status === 404) {
            setError('No photo');
            return;
          }
          throw new Error('Failed to fetch photo URL');
        }

        const data = await response.json();
        if (data.success && data.data?.signedUrl) {
          setSignedUrl(data.data.signedUrl);
        } else {
          setError('No photo available');
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load');
          console.error('Error fetching signed URL:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [visitId]);

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-100 animate-pulse rounded flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-100 rounded flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">{error || 'No photo'}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => showModal && setIsModalOpen(true)}
        className={`${sizeClasses[size]} rounded overflow-hidden ${showModal ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      >
        <img
          src={signedUrl}
          alt="Visit proof photo"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>

      {/* Modal for full-size view */}
      {showModal && isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 z-10"
              aria-label="Close"
            >
              X
            </button>
            <img
              src={signedUrl}
              alt="Visit proof photo - full size"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

// Component for displaying photo with watermark info overlay
interface VisitPhotoWithInfoProps extends VisitPhotoPreviewProps {
  visitInfo?: {
    outlet: string;
    salesRep: string;
    checkInTime: string;
    distance: number;
    status: string;
  };
}

export function VisitPhotoWithInfo({
  visitId,
  visitInfo,
  size = 'lg',
  className = '',
}: VisitPhotoWithInfoProps) {
  return (
    <div className={`relative ${className}`}>
      <VisitPhotoPreview visitId={visitId} size={size} showModal={true} />
      {visitInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 text-xs">
          <p className="font-medium">{visitInfo.outlet}</p>
          <p>{visitInfo.salesRep} | {visitInfo.checkInTime}</p>
          <p>Distance: {visitInfo.distance}m | {visitInfo.status}</p>
        </div>
      )}
    </div>
  );
}
