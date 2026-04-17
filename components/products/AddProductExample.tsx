"use client";

import { AddProductFlow } from "./AddProductFlow";
import type { ProductFamily } from "./AddProductFlow";

// Mock data - replace with actual data from your API
const mockProductFamilies: ProductFamily[] = [
  {
    id: "pf-1",
    name: "Industrial Coatings",
    description: "High-performance coatings for industrial applications",
    availableSpecGroups: [
      {
        id: "sg-1",
        label: "Physical Properties",
        items: [
          {
            id: "spec-1",
            label: "Viscosity (cP)",
            type: "number",
            required: true,
          },
          {
            id: "spec-2",
            label: "Density (g/cm³)",
            type: "number",
            required: true,
          },
          {
            id: "spec-3",
            label: "Color",
            type: "select",
            options: ["Clear", "White", "Black", "Custom"],
            required: false,
          },
        ],
      },
      {
        id: "sg-2",
        label: "Performance Characteristics",
        items: [
          {
            id: "spec-4",
            label: "Dry Time (hours)",
            type: "number",
            required: true,
          },
          {
            id: "spec-5",
            label: "Coverage (sq ft/gal)",
            type: "number",
            required: false,
          },
          {
            id: "spec-6",
            label: "Finish Type",
            type: "select",
            options: ["Matte", "Satin", "Semi-Gloss", "Gloss"],
            required: true,
          },
        ],
      },
      {
        id: "sg-3",
        label: "Application Details",
        items: [
          {
            id: "spec-7",
            label: "Application Method",
            type: "select",
            options: ["Spray", "Brush", "Roller", "Dip"],
            required: true,
          },
          {
            id: "spec-8",
            label: "Thinning Required",
            type: "select",
            options: ["Yes", "No"],
            required: false,
          },
        ],
      },
    ],
  },
  {
    id: "pf-2",
    name: "Automotive Finishes",
    description: "Premium automotive paint systems and clearcoats",
    availableSpecGroups: [
      {
        id: "sg-4",
        label: "Base Properties",
        items: [
          {
            id: "spec-9",
            label: "VOC Content (g/L)",
            type: "number",
            required: true,
          },
          {
            id: "spec-10",
            label: "Solids Content (%)",
            type: "number",
            required: true,
          },
        ],
      },
      {
        id: "sg-5",
        label: "Curing Specifications",
        items: [
          {
            id: "spec-11",
            label: "Flash Time (min)",
            type: "number",
            required: true,
          },
          {
            id: "spec-12",
            label: "Cure Temperature (°F)",
            type: "number",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "pf-3",
    name: "Marine Coatings",
    description: "Specialized coatings for marine and underwater applications",
    availableSpecGroups: [
      {
        id: "sg-6",
        label: "Environmental Resistance",
        items: [
          {
            id: "spec-13",
            label: "Salt Spray Hours",
            type: "number",
            required: true,
          },
          {
            id: "spec-14",
            label: "Water Immersion Rating",
            type: "select",
            options: ["Excellent", "Good", "Fair"],
            required: true,
          },
        ],
      },
      {
        id: "sg-7",
        label: "Antifouling Properties",
        items: [
          {
            id: "spec-15",
            label: "Biocide Type",
            type: "text",
            required: false,
          },
          {
            id: "spec-16",
            label: "Service Life (months)",
            type: "number",
            required: true,
          },
        ],
      },
    ],
  },
];

export default function AddProductExample() {
  const handleProductSubmit = async (formData: any) => {
    console.log("Submitting product:", formData);
    
    // Here you would make your API call
    // Example:
    // const response = await fetch('/api/products', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(formData),
    // });
    
    // For demo purposes:
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    alert("Product created successfully!");
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">All Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and technical data sheets
          </p>
        </div>

        {/* This is where the AddProductFlow button appears */}
        <AddProductFlow
          productFamilies={mockProductFamilies}
          onSubmit={handleProductSubmit}
          onCancel={() => console.log("Cancelled")}
        />

        {/* Your existing products table/grid would go here */}
        <div className="mt-8 p-8 border rounded-lg bg-muted/30 text-center">
          <p className="text-muted-foreground">
            Your existing products table would appear here
          </p>
        </div>
      </div>
    </div>
  );
}
