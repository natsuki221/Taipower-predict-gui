export interface ReserveType {
    DateTime: Date;
    "瞬時尖峰負載(萬瓩)": number | null;
    "備轉容量(萬瓩)": number | null;
    "備轉容量率(%)": number | null;
}