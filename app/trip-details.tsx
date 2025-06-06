import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTripStore } from '@/store/useTripStore';
import { useUserMode } from '../store/userModeStore';
import { useUserStore } from '../store/userStore';
import { getOrCreateChat } from '@/helpers/chat';
import { db } from '@/config/firebase';
import { deleteChat } from '@/helpers/chat';

export default function TripDetails() {
  const router = useRouter();
  const selectedTrip = useTripStore((state) => state.selectedTrip);
  const currentUser = useUserStore((state) => state.user);
  const { mode } = useUserMode();
  console.log("UserID:",currentUser?.userid);
  console.log("Selected Trip's Driver ID:",selectedTrip?.driverid);

  const [token, setToken] = useState<string | null>(null);
  const [tripRequests, setTripRequests] = useState<any[]>([]);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('userToken');
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Error retrieving token from SecureStore:', error);
      }
    };
    loadToken();
  }, []);

  useEffect(() => {
    if (!selectedTrip?.tripid || !token) return;
    if (mode === 'driver'){
    fetchRequests();
    }
  }, [selectedTrip, token]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`http://10.0.2.2:9000/driver/trips/${selectedTrip.tripid}/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Platform': 'mobile',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      setTripRequests(data.tripRequests);
    } catch (error) {
      console.error('Error fetching trip requests:', error);
    }
  };

  const handleAccept = async (requestId) => {
    if (!token || !selectedTrip?.tripid) {
      Alert.alert("Error", "Missing authentication token or trip ID.");
      return;
    }
  
    Alert.alert("Accept Request", "Are you sure you want to accept this request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const response = await fetch("http://10.0.2.2:9000/driver/acceptPassengerReq", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-Platform": "mobile",
              },
              body: JSON.stringify({ tripId: selectedTrip.tripid, requestId }),
            });
  
            if (!response.ok) {
              throw new Error(`Failed to accept request. Status: ${response.status}`);
            }
  
            const tripsResponse = await fetch("http://10.0.2.2:9000/user/upcomingTrips", {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-Platform": "mobile",
              },
            });
            if (!tripsResponse.ok) {
              throw new Error(`Failed to fetch updated trips. Status: ${tripsResponse.status}`);
            }
            const tripsData = await tripsResponse.json();
            const tripsArray = Array.isArray(tripsData) ? tripsData : tripsData.allTrips || [];
            const updatedTrip = tripsArray.find(trip => trip.tripid === selectedTrip.tripid);
            if (!updatedTrip) {
              throw new Error("Updated trip not found in API response.");
            }
  
            useTripStore.setState({ selectedTrip: updatedTrip });
  
            setTripRequests((prevRequests) =>
              prevRequests.map(req =>
                req.requestId === requestId ? { ...req, status: 'ACCEPTED' } : req
              )
            );
          } catch (error) {
            console.error("Error accepting request:", error);
            Alert.alert("Error", "Could not accept request. Please try again.");
          }
        },
      },
    ]);
  };

  const handleReject = async (requestId) => {
    if (!token || !selectedTrip?.tripid) {
      Alert.alert("Error", "Missing authentication token or trip ID.");
      return;
    }
  
    Alert.alert("Reject Request", "Are you sure you want to reject this request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const response = await fetch("http://10.0.2.2:9000/driver/rejectPassengerReq", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-Platform": "mobile",
              },
              body: JSON.stringify({ tripId: selectedTrip.tripid, requestId }),
            });
  
            if (!response.ok) {
              throw new Error(`Failed to reject request. Status: ${response.status}`);
            }
  
            setTripRequests((prevRequests) => prevRequests.filter(req => req.requestId !== requestId));
          } catch (error) {
            console.error("Error rejecting request:", error);
            Alert.alert("Error", "Could not reject request. Please try again.");
          }
        },
      },
    ]);
  };

  const handleStartOrStopTrip = () => {
    if (!token || !selectedTrip?.tripid) {
      Alert.alert("Error", "Missing authentication token or trip ID.");
      return;
    }
    
    if (selectedTrip.status === 'upcoming') {
      Alert.alert("Start Trip", "Are you sure you want to start this trip?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {              
              const response = await fetch(`http://10.0.2.2:9000/driver/trips/${selectedTrip.tripid}/start`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                  "X-Platform": "mobile",
                },
              });
              if (!response.ok) {
                throw new Error(`Failed to start trip. Status: ${response.status}`);
              }
              const data = await response.json();
              useTripStore.setState({ selectedTrip: { ...selectedTrip, status: 'ongoing' } });
            } catch (error) {
              console.error("Error starting trip:", error);
              Alert.alert("Error", "Could not start trip. Please try again.");
            }
          },
        },
      ]);
    } else if (selectedTrip.status === 'ongoing') {
      Alert.alert("Stop Trip", "Are you sure you want to end this trip?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              const response = await fetch(`http://10.0.2.2:9000/driver/trips/${selectedTrip.tripid}/complete`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                  "X-Platform": "mobile",
                },
              });
              if (!response.ok) {
                throw new Error(`Failed to complete trip. Status: ${response.status}`);
              }
              const data = await response.json();
              useTripStore.setState({ selectedTrip: { ...selectedTrip, status: 'completed' } });
              const mine = currentUser.userid.toString();
              // for every passenger that we accepted...
              tripRequests
                .filter(r => r.status === 'ACCEPTED')
                .forEach(async req => {
                  const other = req.passenger.userId.toString();
                  const chatId = await getOrCreateChat(mine, other);
                  await deleteChat(chatId);
                });
            } catch (error) {
              console.error("Error stopping trip:", error);
              Alert.alert("Error", "Could not end trip. Please try again.");
            }
          },
        },
      ]);
    }
  };

  if (!selectedTrip) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerBackground}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <Text style={styles.driver}>Driver Name: {selectedTrip.drivername}</Text>
        </View>
      </View>
  
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsHeader}>Trip Details</Text>
          <View style={styles.locationItem}>
            <Ionicons name="location-outline" size={20} color="#00308F" />
            <Text style={styles.locationText}>{selectedTrip.sourcename}</Text>
          </View>
          <View style={styles.locationItem}>
            <Ionicons name="location-outline" size={20} color="#FF0000" />
            <Text style={styles.locationText}>{selectedTrip.destinationname}</Text>
          </View>
          <Text style={styles.timeText}>
            {selectedTrip.tripdate ? selectedTrip.tripdate.split('T')[0] : 'No Date'} - {selectedTrip.triptime ? selectedTrip.triptime.slice(0, 5) : 'No Time'}
          </Text>
        </View>
  
        {mode === "driver" && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsHeader}>Passengers</Text>
            {tripRequests.filter(request => request.status !== 'REJECTED').length === 0 ? (
              <Text style={styles.noRequestsText}>No passenger requests</Text>
            ) : (
              tripRequests
                .filter(request => request.status !== 'REJECTED')
                .map((request) => (
                  <View key={request.requestId} style={styles.requestItem}>
                    <Text style={styles.passengerText}>{request.passenger.username}</Text>
                    <View style={styles.buttonRow}>

                      {/* Previous */}
                      {/* <TouchableOpacity
                        style={styles.contactButton}
                        onPress={async () => {
                          const otherId = request.passenger.userId.toString();
                          const mine    = currentUser.userid.toString();
                          const chatId  = await getOrCreateChat(mine, otherId);
                          router.push({ pathname: '/chat-room', params: { chatId } });
                        }}
                        >
                        <Text style={styles.buttonText}>Contact Passenger</Text>
                      </TouchableOpacity>
                      {request.status === 'PENDING' && (
                        <>
                          <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(request.requestId)}>
                            <Text style={styles.buttonText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(request.requestId)}>
                            <Text style={styles.buttonText}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {selectedTrip.status === "completed" && (
                        <TouchableOpacity
                          style={styles.reviewButton}
                          onPress={() => router.push({ pathname: "/review", params: { userId: request.passenger.userId } })}
                          >
                          <Text style={styles.reviewButtonText}>Review</Text>
                        </TouchableOpacity>
                      )} */}

                      {/* New */}
                      {selectedTrip.status !== 'completed' && (
                             <>
                               <TouchableOpacity style={styles.contactButton} onPress={async () => {
                                  const otherId = request.passenger.userId.toString();
                                  const mine    = currentUser.userid.toString();
                                  console.log("My ID (as a driver):",mine);
                                  console.log("Passenger ID:",otherId);
                                  const chatId  = await getOrCreateChat(mine, otherId);
                                  router.push({ pathname: '/chat-room', params: { chatId } });
                                }}>
                                 <Text style={styles.buttonText}>Contact Passenger</Text>
                               </TouchableOpacity>
                               {request.status === 'PENDING' && (
                                 <>
                                   <TouchableOpacity style={styles.acceptButton} onPress={() =>     handleAccept(request.requestId)}>
                                     <Text style={styles.buttonText}>Accept</Text>
                                   </TouchableOpacity>
                                   <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(request.requestId)}>
                                     <Text style={styles.buttonText}>Reject</Text>
                                   </TouchableOpacity>
                                 </>
                               )}
                             </>
                           )}
                           {selectedTrip.status === 'completed' && (
                             <TouchableOpacity style={styles.reviewButton} onPress={() => router.push({ pathname: "/review", params: { userId: request.passenger.userId } })}>
                               <Text style={styles.reviewButtonText}>Review</Text>
                             </TouchableOpacity>
                          )}
                    </View>
                  </View>
                ))
            )}
          </View>
        )}
  
        {mode === "passenger" && (
          <View style={{ marginTop: 20 }}>
            {(selectedTrip.status === "upcoming" || selectedTrip.status === "ongoing") && (
              <TouchableOpacity
                style={styles.contactButton}
                onPress={async () => {
                  const mine    = currentUser.userid.toString();
                  const otherId = selectedTrip.driverid;
                  let data;
                  console.log("My ID (as a passenger):",mine);
                  try {
                      const response = await fetch(`http://10.0.2.2:9000/driver/getUserId/${otherId}`, {
                        method: "GET",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${token}`,
                          "X-Platform": "mobile",
                        },
                      });
                      if (!response.ok) {
                        throw new Error(`Failed to fetch. Status: ${response.status}`);
                      }
                   data = await response.json();
                   console.log(data);
                  }catch (error) {
                    console.error("Error fetching:", error);
                    
                  }
                  console.log(data);
                  let userid = data?.userId;


                  
                  console.log("Driver ID:",userid);
                  userid = userid.toString();
                  const chatId  = await getOrCreateChat(mine, userid);
                  router.push({ pathname: '/chat-room', params: { chatId } });
                }}
                >
               <Text style={styles.buttonText}>Contact Driver</Text>
              </TouchableOpacity>
            )}
            {selectedTrip.status === "completed" && (
              <View style={styles.completedContainer}>
                <View style={styles.completedButton}>
                  <Text style={styles.completedButtonText}>Trip Completed</Text>
                </View>
                <TouchableOpacity style={styles.reviewButton} onPress={() => router.push('/review')}>
                  <Text style={styles.reviewButtonText}>Review Driver</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
  
        {mode === "driver" && selectedTrip.status === "upcoming" && selectedTrip.numberofpassengers > 0 && (
          <TouchableOpacity style={styles.startTripButton} onPress={handleStartOrStopTrip}>
            <Text style={styles.buttonText}>Start Trip</Text>
          </TouchableOpacity>
        )}
        {mode === "driver" && selectedTrip.status === "ongoing" && (
          <TouchableOpacity style={styles.startTripButton} onPress={handleStartOrStopTrip}>
            <Text style={styles.buttonText}>Stop Trip</Text>
          </TouchableOpacity>
        )}
        {mode === "driver" && selectedTrip.status === 'completed' && (
          <View style={styles.completedContainer}>
            <View style={styles.completedButton}>
              <Text style={styles.completedButtonText}>Trip Completed</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBackground: { backgroundColor: '#00308F', paddingTop: 50, paddingBottom: 30, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backButton: { alignSelf: 'flex-start', marginBottom: 10 },
  headerTitle: { fontSize: 18, color: '#FFFFFF', textAlign: 'center', flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  detailsContainer: { backgroundColor: '#F7F9FC', padding: 15, borderRadius: 8, marginBottom: 20 },
  detailsHeader: { fontSize: 16, fontWeight: 'bold', color: '#000000', marginBottom: 10 },
  locationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  locationText: { fontSize: 14, color: '#666666', marginLeft: 10 },
  timeText: { fontSize: 14, color: '#666666', marginLeft: 10 },
  errorText: { color: 'red', fontSize: 18 },
  passengerRequestsContainer: { backgroundColor: '#F7F9FC', padding: 15, borderRadius: 8, marginTop: 20 },
  requestItem: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  passengerText: { fontSize: 14, color: '#333333', marginBottom: 5 },
  noRequestsText: { fontSize: 14, color: '#666666', fontStyle: 'italic' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  contactButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 5,
  },
  driver: { fontSize: 16, color: '#FFFFFF', marginTop: 5, marginLeft: 10, textAlign: 'center' },
  acceptButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  startTripButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  completedContainer: { marginTop: 20 },
  completedButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  completedButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  reviewButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default TripDetails;
