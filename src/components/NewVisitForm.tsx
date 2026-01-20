"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface SalesRep {
  id: string;
  code: string;
  name: string;
}

interface Outlet {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface NewVisitFormProps {
  salesReps: SalesRep[];
  outlets: Outlet[];
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface CheckInResponse {
  id: string;
  distance: number;
  distanceStatus: 'OK' | 'TOO_FAR';
  status: string;
}

export function NewVisitForm({ salesReps, outlets }: NewVisitFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form state
  const [salesRepId, setSalesRepId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [notes, setNotes] = useState('');

  // Location state
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Check-in state
  const [visitId, setVisitId] = useState<string | null>(null);
  const [checkInData, setCheckInData] = useState<CheckInResponse | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Photo state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkedBlob, setWatermarkedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

  const selectedOutlet = outlets.find((o) => o.id === outletId);
  const selectedSalesRep = salesReps.find((s) => s.id === salesRepId);

  // Get current location
  const getCurrentLocation = () => {
    setGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGettingLocation(false);
      },
      (error) => {
        setLocationError(`Unable to get location: ${error.message}`);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  };

  // Handle check-in
  const handleCheckIn = async () => {
    if (!salesRepId || !outletId || !location) {
      setCheckInError('Please select sales rep, outlet, and get your location first');
      return;
    }

    setCheckingIn(true);
    setCheckInError(null);

    try {
      const response = await fetch('/api/visits/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify({
          salesRepId,
          outletId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      setVisitId(data.data.id);
      setCheckInData({
        id: data.data.id,
        distance: data.data.distance,
        distanceStatus: data.data.distanceStatus,
        status: data.data.status,
      });
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('Please select a JPEG or PNG image');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Apply watermark when file is selected
  useEffect(() => {
    if (!selectedFile || !previewUrl || !canvasRef.current || !checkInData || !selectedOutlet || !selectedSalesRep || !location) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Resize to max 1280 width
      const maxWidth = 1280;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Add watermark overlay
      const now = new Date();
      const watermarkLines = [
        `Outlet: ${selectedOutlet.name} (${selectedOutlet.code})`,
        `Sales: ${selectedSalesRep.name} (${selectedSalesRep.code})`,
        `Time: ${now.toISOString()}`,
        `Lat/Lng: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        `Accuracy: ${location.accuracy.toFixed(0)}m`,
        `Distance: ${checkInData.distance.toFixed(0)}m | Status: ${checkInData.distanceStatus}`,
      ];

      // Semi-transparent background for watermark
      const lineHeight = 18;
      const padding = 10;
      const watermarkHeight = watermarkLines.length * lineHeight + padding * 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, height - watermarkHeight, width, watermarkHeight);

      // Draw watermark text
      ctx.fillStyle = 'white';
      ctx.font = '14px monospace';
      watermarkLines.forEach((line, index) => {
        ctx.fillText(line, padding, height - watermarkHeight + padding + (index + 1) * lineHeight - 4);
      });

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setWatermarkedBlob(blob);
          }
        },
        selectedFile.type,
        0.9
      );
    };
    img.src = previewUrl;
  }, [selectedFile, previewUrl, checkInData, selectedOutlet, selectedSalesRep, location]);

  // Handle photo upload
  const handleUpload = async () => {
    if (!visitId || !watermarkedBlob) {
      setUploadError('Please check-in and select a photo first');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', watermarkedBlob, selectedFile?.name || 'photo.jpg');

      const response = await fetch(`/api/visits/${visitId}/photo`, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedPhotoUrl(data.data.signedUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Success state
  if (uploadedPhotoUrl) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Visit Recorded Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Check-in and photo proof have been uploaded.
          </p>

          <div className="max-w-md mx-auto mb-6">
            <img
              src={uploadedPhotoUrl}
              alt="Uploaded photo"
              className="rounded-lg shadow-md w-full"
            />
          </div>

          <div className="flex gap-4 justify-center">
            <Link href={`/visits/${visitId}`} className="btn btn-primary">
              View Visit Details
            </Link>
            <Link href="/visits" className="btn btn-secondary">
              Back to Visits
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Sales Rep and Outlet */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Step 1: Select Sales Rep & Outlet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sales Representative
            </label>
            <select
              className="input w-full"
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
              disabled={!!visitId}
            >
              <option value="">Select sales rep...</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.code} - {rep.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outlet
            </label>
            <select
              className="input w-full"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              disabled={!!visitId}
            >
              <option value="">Select outlet...</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.code} - {outlet.name}
                </option>
              ))}
            </select>
            {selectedOutlet && selectedOutlet.address && (
              <p className="text-xs text-gray-500 mt-1">{selectedOutlet.address}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              className="input w-full"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!!visitId}
              placeholder="Any additional notes..."
            />
          </div>
        </div>
      </div>

      {/* Step 2: Get Location */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Step 2: Get Current Location</h2>
        {location ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium mb-2">Location acquired:</p>
            <p className="font-mono text-sm text-green-700">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Accuracy: {location.accuracy.toFixed(0)}m
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={gettingLocation || !!visitId}
              className="btn btn-secondary"
            >
              {gettingLocation ? 'Getting location...' : 'Get Current Location'}
            </button>
            {locationError && (
              <p className="text-red-600 text-sm mt-2">{locationError}</p>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Check-In */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Step 3: Check-In</h2>
        {checkInData ? (
          <div className={`border rounded-lg p-4 ${
            checkInData.distanceStatus === 'OK'
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className={`font-medium mb-2 ${
              checkInData.distanceStatus === 'OK' ? 'text-green-800' : 'text-yellow-800'
            }`}>
              Check-in successful!
            </p>
            <p className={`text-sm ${
              checkInData.distanceStatus === 'OK' ? 'text-green-700' : 'text-yellow-700'
            }`}>
              Distance from outlet: {checkInData.distance.toFixed(0)}m
              {checkInData.distanceStatus === 'TOO_FAR' && (
                <span className="ml-2 text-yellow-600">(exceeds 200m threshold)</span>
              )}
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={!salesRepId || !outletId || !location || checkingIn}
              className="btn btn-primary"
            >
              {checkingIn ? 'Checking in...' : 'Check In Now'}
            </button>
            {checkInError && (
              <p className="text-red-600 text-sm mt-2">{checkInError}</p>
            )}
            {(!salesRepId || !outletId || !location) && (
              <p className="text-gray-500 text-sm mt-2">
                Complete steps 1 and 2 first
              </p>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Upload Photo (only shown after check-in) */}
      {visitId && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Step 4: Upload Photo Proof</h2>
          <p className="text-sm text-gray-600 mb-4">
            Take a photo at the outlet location. A watermark with visit details will be automatically added.
          </p>

          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
            >
              {selectedFile ? 'Change Photo' : 'Select Photo'}
            </button>

            {/* Hidden canvas for watermarking */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Preview */}
            {watermarkedBlob && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview (with watermark):</p>
                <img
                  src={URL.createObjectURL(watermarkedBlob)}
                  alt="Preview with watermark"
                  className="max-w-md rounded-lg shadow-md"
                />
              </div>
            )}

            {uploadError && (
              <p className="text-red-600 text-sm">{uploadError}</p>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={!watermarkedBlob || uploading}
              className="btn btn-primary"
            >
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </div>
      )}

      {/* Cancel link */}
      <div className="flex justify-end">
        <Link href="/visits" className="text-gray-500 hover:text-gray-700">
          Cancel and go back
        </Link>
      </div>
    </div>
  );
}
